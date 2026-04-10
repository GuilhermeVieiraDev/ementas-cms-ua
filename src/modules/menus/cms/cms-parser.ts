import { load } from 'cheerio';

import { createAnomaly } from './cms-anomalies.js';
import {
  extractBodyLines,
  extractCanteenName,
  getCanteenId,
  inferYearFromNeighborHeaders,
  isClosedLine,
  isServiceMarker,
  parseHeaderEntries,
  parseMenuLine,
} from './cms-normalizers.js';
import { CMS_URL, selectors } from './cms-selectors.js';
import type {
  CanteenMenu,
  MealMenu,
  MealService,
  MenuDay,
  ScrapeAnomaly,
  ScrapedDataset,
} from '../menus.types.js';

interface ParseCmsHtmlOptions {
  sourceUrl?: string;
  fetchedAt?: string;
}

function ensureDay(daysByDate: Map<string, MenuDay>, date: string, weekday: string): MenuDay {
  const existing = daysByDate.get(date);
  if (existing) return existing;

  const day: MenuDay = {
    date,
    weekday,
    meals: [],
  };
  daysByDate.set(date, day);
  return day;
}

function mergeMeal(existing: MealMenu, incoming: MealMenu): void {
  if (existing.status === 'closed' && incoming.status === 'available') {
    existing.status = 'available';
  }
  if (existing.status === 'empty' && incoming.status !== 'empty') {
    existing.status = incoming.status;
  }

  existing.items.push(...incoming.items);
}

function pushMeal(day: MenuDay, meal: MealMenu): void {
  const existing = day.meals.find((candidate) => candidate.service === meal.service);
  if (existing) {
    mergeMeal(existing, meal);
    return;
  }

  day.meals.push(meal);
}

function buildMealsFromLines(
  lines: string[],
  serviceHint: MealService | null,
): MealMenu[] {
  if (lines.length === 0) {
    return [
      {
        service: serviceHint ?? 'unknown',
        status: 'empty',
        items: [],
      },
    ];
  }

  const grouped = new Map<MealService, string[]>();
  const hasMarkers = lines.some((line) => isServiceMarker(line) !== null);

  if (hasMarkers) {
    let currentService: MealService | null = null;

    for (const line of lines) {
      const marker = isServiceMarker(line);
      if (marker) {
        currentService = marker;
        if (!grouped.has(marker)) grouped.set(marker, []);
        continue;
      }

      const target = currentService ?? serviceHint ?? 'lunch';
      const existing = grouped.get(target) ?? [];
      existing.push(line);
      grouped.set(target, existing);
    }
  } else {
    grouped.set(serviceHint ?? 'lunch', [...lines]);
  }

  return [...grouped.entries()].map(([service, serviceLines]) => {
    const menuLines = serviceLines.filter((line) => !isClosedLine(line));

    if (menuLines.length === 0 && serviceLines.some(isClosedLine)) {
      return {
        service,
        status: 'closed',
        items: [],
      } satisfies MealMenu;
    }

    return {
      service,
      status: menuLines.length > 0 ? 'available' : 'empty',
      items: menuLines.map(parseMenuLine),
    } satisfies MealMenu;
  });
}

export function parseCmsHtml(
  html: string,
  options: ParseCmsHtmlOptions = {},
): ScrapedDataset {
  const $ = load(html);
  const anomalies: ScrapeAnomaly[] = [];

  const canteens: CanteenMenu[] = $(selectors.rootTables)
    .toArray()
    .map((table) => {
      const caption = $(table).find(selectors.canteenCaption).first().text();
      const canteenName = extractCanteenName(caption);
      const canteenId = getCanteenId(caption);
      const rows = $(table).find(selectors.row).toArray();
      const rowHeaders = rows.map((row) => $(row).find(selectors.titleCell).first().text());
      const daysByDate = new Map<string, MenuDay>();

      for (const [rowIndex, row] of rows.entries()) {
        const rawHeader = rowHeaders[rowIndex] ?? '';
        const inferredYear = inferYearFromNeighborHeaders(rowHeaders, rowIndex);
        const headerEntries = parseHeaderEntries(rawHeader, canteenId, inferredYear, anomalies);
        if (headerEntries.length === 0) continue;

        const bodyCell = $(row).find(selectors.bodyCell).first().get(0);
        const lines = bodyCell ? extractBodyLines($, bodyCell) : [];
        if (lines.length === 0) {
          anomalies.push(
            createAnomaly('EMPTY_BODY', canteenId, rawHeader, 'Row body is empty'),
          );
        }

        for (const header of headerEntries) {
          const meals = buildMealsFromLines(lines, header.serviceHint);

          const day = ensureDay(daysByDate, header.date, header.weekday);
          for (const meal of meals) {
            pushMeal(day, meal);
          }
        }
      }

      const days = [...daysByDate.values()].sort((left, right) =>
        left.date.localeCompare(right.date),
      );

      return {
        id: canteenId,
        name: canteenName,
        days,
      } satisfies CanteenMenu;
    });

  const allDates = canteens.flatMap((canteen) => canteen.days.map((day) => day.date));
  const sortedDates = [...allDates].sort((left, right) => left.localeCompare(right));

  return {
    sourceUrl: options.sourceUrl ?? CMS_URL,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    canteens,
    anomalies,
    availableRange: {
      from: sortedDates[0] ?? null,
      to: sortedDates.at(-1) ?? null,
    },
  };
}
