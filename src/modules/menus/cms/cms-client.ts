import { logger } from '../../../lib/logger.js';
import { HttpError } from '../../../lib/http-error.js';
import { CMS_URL } from './cms-selectors.js';

const REQUEST_TIMEOUT_MS = 10_000;

export class CmsClient {
  public async fetchHtml(): Promise<string> {
    try {
      return await this.fetchWithRetry();
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch CMS HTML');
      throw new HttpError(502, 'UPSTREAM_FETCH_FAILED', 'Failed to fetch CMS source');
    }
  }

  private async fetchWithRetry(): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(CMS_URL, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Unexpected CMS status: ${response.status}`);
          }

          const html = await response.text();
          if (!html.trim()) {
            throw new Error('CMS response body is empty');
          }

          return html;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown CMS fetch error');
  }
}
