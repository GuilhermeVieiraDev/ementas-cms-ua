import { ZodError } from 'zod';
import { DateTime } from 'luxon';

import { env } from '../../config/env.js';
import { getTodayIsoDate, LISBON_TIMEZONE } from '../../lib/dates.js';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { parseCmsHtml } from './cms/cms-parser.js';
import { CmsClient } from './cms/cms-client.js';
import { menusQuerySchema } from './menus.schemas.js';
import type {
  CanteensResponse,
  HealthResponse,
  MenusQuery,
  MenusResponse,
  ScrapedDataset,
} from './menus.types.js';

interface CacheState {
  dataset: ScrapedDataset;
  fetchedAtMs: number;
}

interface SourceLike {
  fetchHtml(): Promise<string>;
}

interface ServiceOptions {
  cacheTtlMs?: number;
  staleCacheMaxAgeMs?: number;
  now?: () => number;
}

export class MenusService {
  private readonly source: SourceLike;
  private readonly cacheTtlMs: number;
  private readonly staleCacheMaxAgeMs: number;
  private readonly now: () => number;
  private cache: CacheState | null = null;
  private inFlightRefresh: Promise<CacheState> | null = null;

  public constructor(source: SourceLike = new CmsClient(), options: ServiceOptions = {}) {
    this.source = source;
    this.cacheTtlMs = options.cacheTtlMs ?? env.CACHE_TTL_MS;
    this.staleCacheMaxAgeMs = options.staleCacheMaxAgeMs ?? env.STALE_CACHE_MAX_AGE_MS;
    this.now = options.now ?? Date.now;
  }

  public warmCache(): void {
    void this.refreshCache().catch((error: unknown) => {
      logger.warn({ err: error }, 'Initial CMS cache warmup failed');
    });
  }

  public getHealth(): HealthResponse {
    const ageMs = this.cache ? this.now() - this.cache.fetchedAtMs : null;

    return {
      status: 'ok',
      time: new Date(this.now()).toISOString(),
      cache: {
        hasData: this.cache !== null,
        lastSuccessfulScrapeAt: this.cache?.dataset.fetchedAt ?? null,
        ageMs,
        stale: ageMs !== null ? ageMs > this.cacheTtlMs : false,
      },
    };
  }

  public async getCanteens(): Promise<CanteensResponse> {
    const cacheResult = await this.getDatasetForRequest();

    return {
      canteens: cacheResult.dataset.canteens.map((canteen) => ({
        id: canteen.id,
        name: canteen.name,
      })),
    };
  }

  public async getMenus(query: MenusQuery): Promise<MenusResponse> {
    const cacheResult = await this.getDatasetForRequest();
    const { dataset } = cacheResult;

    if (query.canteens && query.canteens.length > 0) {
      const knownIds = new Set(dataset.canteens.map((canteen) => canteen.id));
      const invalidIds = query.canteens.filter((canteenId) => !knownIds.has(canteenId));
      if (invalidIds.length > 0) {
        throw new HttpError(
          400,
          'BAD_REQUEST',
          `Unknown canteen ids: ${invalidIds.join(', ')}`,
        );
      }
    }

    const selectedIds = query.canteens ? new Set(query.canteens) : null;
    const canteens = dataset.canteens
      .filter((canteen) => (selectedIds ? selectedIds.has(canteen.id) : true))
      .map((canteen) => ({
        ...canteen,
        days: canteen.days.filter(
          (day) => day.date >= query.from && day.date <= query.to,
        ),
      }));

    const anomalies = dataset.anomalies.filter((anomaly) =>
      selectedIds ? selectedIds.has(anomaly.canteenId) : true,
    );

    return {
      meta: {
        sourceUrl: dataset.sourceUrl,
        fetchedAt: dataset.fetchedAt,
        requestedRange: {
          from: query.from,
          to: query.to,
        },
        availableRange: dataset.availableRange,
        timezone: LISBON_TIMEZONE,
        cached: cacheResult.cached,
        stale: cacheResult.stale,
        anomalyCount: anomalies.length,
      },
      canteens,
      anomalies: query.includeAnomalies ? anomalies : [],
    };
  }

  public normalizeQuery(rawQuery: unknown): MenusQuery {
    try {
      const parsed = menusQuerySchema.parse(rawQuery);
      const fallbackDate =
        DateTime.fromMillis(this.now(), { zone: LISBON_TIMEZONE }).toISODate() ??
        getTodayIsoDate();
      const from = parsed.from ?? parsed.to ?? fallbackDate;
      const to = parsed.to ?? parsed.from ?? fallbackDate;

      if (from > to) {
        throw new HttpError(400, 'BAD_REQUEST', '`from` must be before or equal to `to`');
      }

      if (parsed.canteens) {
        return {
          from,
          to,
          canteens: parsed.canteens,
          includeAnomalies: parsed.includeAnomalies,
        };
      }

      return {
        from,
        to,
        includeAnomalies: parsed.includeAnomalies,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, 'BAD_REQUEST', error.issues[0]?.message ?? 'Invalid query');
      }

      throw error;
    }
  }

  private async getDatasetForRequest(): Promise<{
    dataset: ScrapedDataset;
    cached: boolean;
    stale: boolean;
  }> {
    const currentCache = this.cache;
    const currentAge = currentCache ? this.now() - currentCache.fetchedAtMs : null;

    if (currentCache && currentAge !== null && currentAge <= this.cacheTtlMs) {
      return {
        dataset: currentCache.dataset,
        cached: true,
        stale: false,
      };
    }

    try {
      const refreshed = await this.refreshCache();
      return {
        dataset: refreshed.dataset,
        cached: false,
        stale: false,
      };
    } catch (error) {
      if (
        currentCache &&
        currentAge !== null &&
        currentAge <= this.staleCacheMaxAgeMs
      ) {
        logger.warn({ err: error }, 'Serving stale CMS cache after refresh failure');
        return {
          dataset: currentCache.dataset,
          cached: true,
          stale: true,
        };
      }

      throw error;
    }
  }

  private async refreshCache(): Promise<CacheState> {
    if (this.inFlightRefresh) return this.inFlightRefresh;

    this.inFlightRefresh = (async () => {
      const html = await this.source.fetchHtml();
      const timestamp = this.now();
      const dataset = parseCmsHtml(html, {
        fetchedAt: new Date(timestamp).toISOString(),
      });

      const nextCache: CacheState = {
        dataset,
        fetchedAtMs: timestamp,
      };
      this.cache = nextCache;
      return nextCache;
    })();

    try {
      return await this.inFlightRefresh;
    } finally {
      this.inFlightRefresh = null;
    }
  }
}
