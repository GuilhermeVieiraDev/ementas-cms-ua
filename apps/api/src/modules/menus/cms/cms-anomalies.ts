import type { ScrapeAnomaly } from '../menus.types.js';

export function createAnomaly(
  code: ScrapeAnomaly['code'],
  canteenId: string,
  rawHeader: string,
  message: string,
): ScrapeAnomaly {
  return {
    code,
    canteenId,
    rawHeader,
    message,
  };
}
