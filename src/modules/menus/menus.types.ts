export type MealService = 'lunch' | 'dinner' | 'unknown';
export type MealStatus = 'available' | 'closed' | 'empty';
export type MenuItemCategory =
  | 'soup'
  | 'meat'
  | 'fish'
  | 'diet'
  | 'vegetarian'
  | 'other';

export interface MenuItem {
  category: MenuItemCategory;
  sourceLabel: string | null;
  text: string;
}

export interface MealMenu {
  service: MealService;
  status: MealStatus;
  items: MenuItem[];
}

export interface MenuDay {
  date: string;
  weekday: string;
  meals: MealMenu[];
}

export interface CanteenMenu {
  id: string;
  name: string;
  days: MenuDay[];
}

export interface ScrapeAnomaly {
  code:
    | 'INVALID_HEADER'
    | 'INVALID_DATE'
    | 'INFERRED_YEAR'
    | 'IGNORED_WEEKDAY'
    | 'EMPTY_BODY'
    | 'UNCLASSIFIED_LINE';
  canteenId: string;
  rawHeader: string;
  message: string;
}

export interface RangeMeta {
  from: string | null;
  to: string | null;
}

export interface ScrapedDataset {
  sourceUrl: string;
  fetchedAt: string;
  canteens: CanteenMenu[];
  anomalies: ScrapeAnomaly[];
  availableRange: RangeMeta;
}

export interface MenusQuery {
  from: string;
  to: string;
  canteens?: string[];
  includeAnomalies: boolean;
}

export interface MenusResponse {
  meta: {
    sourceUrl: string;
    fetchedAt: string;
    requestedRange: {
      from: string;
      to: string;
    };
    availableRange: RangeMeta;
    timezone: string;
    cached: boolean;
    stale: boolean;
    anomalyCount: number;
  };
  canteens: CanteenMenu[];
  anomalies: ScrapeAnomaly[];
}

export interface CanteensResponse {
  canteens: Array<{ id: string; name: string }>;
}

export interface HealthResponse {
  status: 'ok';
  time: string;
  cache: {
    hasData: boolean;
    lastSuccessfulScrapeAt: string | null;
    ageMs: number | null;
    stale: boolean;
  };
}
