import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { DateTime } from 'luxon';

import {
  englishWeekdayFromIso,
  LISBON_TIMEZONE,
  portugueseWeekdayFromIso,
} from '../../../lib/dates.js';
import { slugify } from '../../../lib/slugify.js';
import type {
  MealService,
  MenuItem,
  MenuItemCategory,
  ScrapeAnomaly,
} from '../menus.types.js';
import { createAnomaly } from './cms-anomalies.js';

interface HeaderParseSuccess {
  date: string;
  weekday: string;
  serviceHint: MealService | null;
}

type HeaderParseResult = HeaderParseSuccess | null;

interface HeaderDateParts {
  day: number;
  month: number;
  yearText: string;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeLooseSpaces(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function normalizeComparable(value: string): string {
  return normalizeSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeWeekdayComparable(value: string): string {
  return normalizeComparable(value).replace(/-feira$/u, '');
}

function getServicesFromText(value: string): MealService[] {
  const normalized = normalizeComparable(value);
  const services: MealService[] = [];

  if (normalized.includes('almoco')) services.push('lunch');
  if (normalized.includes('jantar')) services.push('dinner');

  return services;
}

export function extractCanteenName(caption: string): string {
  return normalizeSpaces(caption.replace(/^Cantina:\s*/i, ''));
}

export function getCanteenId(caption: string): string {
  return slugify(extractCanteenName(caption));
}

function parseHeaderDateParts(rawHeader: string): HeaderDateParts | null {
  const normalizedHeader = normalizeSpaces(rawHeader);
  if (!normalizedHeader) return null;

  let remainder = normalizedHeader;
  const comparable = normalizeComparable(normalizedHeader);

  if (comparable.startsWith('almoco ')) {
    remainder = normalizeSpaces(normalizedHeader.slice('Almoço'.length));
  } else if (comparable === 'almoco') {
    remainder = '';
  } else if (comparable.startsWith('jantar ')) {
    remainder = normalizeSpaces(normalizedHeader.slice('Jantar'.length));
  } else if (comparable === 'jantar') {
    remainder = '';
  }

  const match = remainder.match(
    /^(?:(?<weekday>[^\d]+?)\s+)?(?<day>\d{2})\/(?<month>\d{2})\/+(?<year>\d{1,4})$/u,
  );
  if (!match?.groups) return null;

  const dayText = match.groups.day;
  const monthText = match.groups.month;
  const yearText = match.groups.year;
  if (!dayText || !monthText || !yearText) return null;

  return {
    day: Number(dayText),
    month: Number(monthText),
    yearText,
  };
}

function buildValidDate(parts: HeaderDateParts, year: number): DateTime | null {
  const date = DateTime.fromObject(
    {
      day: parts.day,
      month: parts.month,
      year,
    },
    { zone: LISBON_TIMEZONE },
  );

  return date.isValid ? date : null;
}

function getValidDateFromHeader(rawHeader: string): DateTime | null {
  const parts = parseHeaderDateParts(rawHeader);
  if (!parts || parts.yearText.length !== 4) return null;

  return buildValidDate(parts, Number(parts.yearText));
}

export function inferYearFromNeighborHeaders(
  headers: string[],
  targetIndex: number,
): number | null {
  const targetParts = parseHeaderDateParts(headers[targetIndex] ?? '');
  if (!targetParts) return null;

  const declaredYear =
    targetParts.yearText.length === 4 ? Number(targetParts.yearText) : null;
  const declaredDate =
    declaredYear !== null ? buildValidDate(targetParts, declaredYear) : null;

  let previousDate: DateTime | null = null;
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const candidate = getValidDateFromHeader(headers[index] ?? '');
    if (candidate) {
      previousDate = candidate;
      break;
    }
  }

  let nextDate: DateTime | null = null;
  for (let index = targetIndex + 1; index < headers.length; index += 1) {
    const candidate = getValidDateFromHeader(headers[index] ?? '');
    if (candidate) {
      nextDate = candidate;
      break;
    }
  }

  const candidateYears = new Set<number>();
  if (previousDate) {
    candidateYears.add(previousDate.year - 1);
    candidateYears.add(previousDate.year);
    candidateYears.add(previousDate.year + 1);
  }
  if (nextDate) {
    candidateYears.add(nextDate.year - 1);
    candidateYears.add(nextDate.year);
    candidateYears.add(nextDate.year + 1);
  }
  if (declaredYear !== null) {
    candidateYears.add(declaredYear);
  }

  if (
    declaredDate &&
    (!previousDate || declaredDate.toMillis() >= previousDate.toMillis()) &&
    (!nextDate || declaredDate.toMillis() <= nextDate.toMillis())
  ) {
    return null;
  }

  const rankedCandidates = [...candidateYears]
    .map((year) => {
      const date = buildValidDate(targetParts, year);
      if (!date) return null;

      if (previousDate && date.toMillis() < previousDate.toMillis()) return null;
      if (nextDate && date.toMillis() > nextDate.toMillis()) return null;

      const previousGap = previousDate
        ? date.diff(previousDate, 'days').days
        : Number.POSITIVE_INFINITY;
      const nextGap = nextDate
        ? nextDate.diff(date, 'days').days
        : Number.POSITIVE_INFINITY;
      const score =
        (Number.isFinite(previousGap) ? previousGap : 0) +
        (Number.isFinite(nextGap) ? nextGap : 0);

      return {
        year,
        score,
      };
    })
    .filter((candidate): candidate is { year: number; score: number } => candidate !== null)
    .sort((left, right) => left.score - right.score);

  return rankedCandidates[0]?.year ?? null;
}

export function parseHeader(
  rawHeader: string,
  canteenId: string,
  inferredYear: number | null,
  anomalies: ScrapeAnomaly[],
): HeaderParseResult {
  const normalizedHeader = normalizeSpaces(rawHeader);

  if (!normalizedHeader) {
    anomalies.push(
      createAnomaly('INVALID_HEADER', canteenId, rawHeader, 'Missing row header text'),
    );
    return null;
  }

  let serviceHint: MealService | null = null;
  let remainder = normalizedHeader;
  const comparable = normalizeComparable(normalizedHeader);

  if (comparable.startsWith('almoco ')) {
    serviceHint = 'lunch';
    remainder = normalizeSpaces(normalizedHeader.slice('Almoço'.length));
  } else if (comparable === 'almoco') {
    serviceHint = 'lunch';
    remainder = '';
  } else if (comparable.startsWith('jantar ')) {
    serviceHint = 'dinner';
    remainder = normalizeSpaces(normalizedHeader.slice('Jantar'.length));
  } else if (comparable === 'jantar') {
    serviceHint = 'dinner';
    remainder = '';
  }

  const match = remainder.match(
    /^(?:(?<weekday>[^\d]+?)\s+)?(?<day>\d{2})\/(?<month>\d{2})\/+(?<year>\d{1,4})$/u,
  );

  if (!match?.groups) {
    anomalies.push(
      createAnomaly(
        'INVALID_HEADER',
        canteenId,
        rawHeader,
        'Header did not match a supported CMS date pattern',
      ),
    );
    return null;
  }

  const dayText = match.groups.day;
  const monthText = match.groups.month;
  const yearText = match.groups.year;
  if (!dayText || !monthText || !yearText) {
    anomalies.push(
      createAnomaly(
        'INVALID_HEADER',
        canteenId,
        rawHeader,
        'Header did not include a complete day, month, and year',
      ),
    );
    return null;
  }

  const day = Number(dayText);
  const month = Number(monthText);
  const sourceWeekday = match.groups.weekday ? normalizeSpaces(match.groups.weekday) : null;

  let year = Number(yearText);
  if (yearText.length !== 4 || (inferredYear !== null && inferredYear !== year)) {
    if (inferredYear === null) {
      anomalies.push(
        createAnomaly(
          'INVALID_DATE',
          canteenId,
          rawHeader,
          `Unable to infer a valid year from header value "${yearText}"`,
        ),
      );
      return null;
    }

    year = inferredYear;
    anomalies.push(
      createAnomaly(
        'INFERRED_YEAR',
        canteenId,
        rawHeader,
        `Inferred year ${inferredYear} from neighboring rows`,
      ),
    );
  }

  const date = DateTime.fromObject({ day, month, year }, { zone: LISBON_TIMEZONE });
  if (!date.isValid) {
    anomalies.push(
      createAnomaly(
        'INVALID_DATE',
        canteenId,
        rawHeader,
        `Parsed date is invalid: ${date.invalidExplanation ?? 'unknown reason'}`,
      ),
    );
    return null;
  }

  const isoDate = date.toISODate();
  if (!isoDate) {
    anomalies.push(
      createAnomaly('INVALID_DATE', canteenId, rawHeader, 'Failed to build an ISO date'),
    );
    return null;
  }

  if (sourceWeekday) {
    const normalizedSourceWeekday = normalizeWeekdayComparable(sourceWeekday);
    const expectedWeekday = normalizeWeekdayComparable(portugueseWeekdayFromIso(isoDate));
    if (normalizedSourceWeekday !== expectedWeekday) {
      anomalies.push(
        createAnomaly(
          'IGNORED_WEEKDAY',
          canteenId,
          rawHeader,
          `Ignored source weekday "${sourceWeekday}" and used computed weekday`,
        ),
      );
    }
  }

  return {
    date: isoDate,
    weekday: englishWeekdayFromIso(isoDate),
    serviceHint,
  };
}

export function parseHeaderEntries(
  rawHeader: string,
  canteenId: string,
  inferredYear: number | null,
  anomalies: ScrapeAnomaly[],
): HeaderParseSuccess[] {
  const rangeEntries = parseRangeHeader(rawHeader, canteenId, anomalies);
  if (rangeEntries) return rangeEntries;

  const singleEntry = parseHeader(rawHeader, canteenId, inferredYear, anomalies);
  return singleEntry ? [singleEntry] : [];
}

function parseRangeHeader(
  rawHeader: string,
  canteenId: string,
  anomalies: ScrapeAnomaly[],
): HeaderParseSuccess[] | null {
  const normalizedHeader = normalizeSpaces(rawHeader);
  const match = normalizedHeader.match(
    /^De\s+(?<startDay>\d{2})\/(?<startMonth>\d{2})\s+a\s+(?<endDay>\d{2})\/(?<endMonth>\d{2})\/(?<year>\d{4})\s+(?<services>.+)$/iu,
  );

  if (!match?.groups) return null;

  const startDay = Number(match.groups.startDay);
  const startMonth = Number(match.groups.startMonth);
  const endDay = Number(match.groups.endDay);
  const endMonth = Number(match.groups.endMonth);
  const year = Number(match.groups.year);
  const services = getServicesFromText(match.groups.services ?? '');
  const serviceHints = services.length > 0 ? services : (['unknown'] satisfies MealService[]);

  let startDate = DateTime.fromObject(
    { day: startDay, month: startMonth, year },
    { zone: LISBON_TIMEZONE },
  );
  const endDate = DateTime.fromObject(
    { day: endDay, month: endMonth, year },
    { zone: LISBON_TIMEZONE },
  );

  if (!startDate.isValid || !endDate.isValid) {
    anomalies.push(
      createAnomaly(
        'INVALID_DATE',
        canteenId,
        rawHeader,
        'Date range header contains an invalid start or end date',
      ),
    );
    return [];
  }

  if (startDate > endDate) {
    startDate = startDate.minus({ years: 1 });
  }

  const entries: HeaderParseSuccess[] = [];
  for (
    let currentDate = startDate;
    currentDate <= endDate;
    currentDate = currentDate.plus({ days: 1 })
  ) {
    const isoDate = currentDate.toISODate();
    if (!isoDate) continue;

    for (const serviceHint of serviceHints) {
      entries.push({
        date: isoDate,
        weekday: englishWeekdayFromIso(isoDate),
        serviceHint,
      });
    }
  }

  return entries;
}

function isLegendLine(value: string): boolean {
  const comparable = normalizeComparable(value);
  return comparable.includes('legendas relativas ao rotulo ambiental e alergenios');
}

function cleanLine(value: string): string {
  return normalizeLooseSpaces(value);
}

export function extractBodyLines($: CheerioAPI, bodyCell: Element): string[] {
  const cloned = $(bodyCell).clone();
  cloned.find('img, span').remove();
  cloned.find('br').replaceWith('\n');
  cloned.find('a').each((_, element) => {
    $(element).replaceWith($(element).text());
  });

  const paragraphs = cloned.find('p').toArray();
  const rawChunks =
    paragraphs.length > 0
      ? paragraphs.flatMap((paragraph) => $(paragraph).text().split('\n'))
      : cloned.text().split('\n');

  return rawChunks
    .map(cleanLine)
    .filter((line) => line.length > 0 && !isLegendLine(line));
}

export function isServiceMarker(line: string): MealService | null {
  const comparable = normalizeComparable(line);
  if (comparable === 'almoco') return 'lunch';
  if (comparable === 'jantar') return 'dinner';
  return null;
}

export function isClosedLine(line: string): boolean {
  const normalized = normalizeComparable(line);
  return normalized === 'encerrado' || normalized.includes('encerrad');
}

const CATEGORY_MAPPINGS: Array<{
  prefix: string;
  category: MenuItemCategory;
}> = [
  { prefix: 'Prato Carne', category: 'meat' },
  { prefix: 'Prato Peixe', category: 'fish' },
  { prefix: 'Vegetariana', category: 'vegetarian' },
  { prefix: 'Dieta', category: 'diet' },
  { prefix: 'Carne', category: 'meat' },
  { prefix: 'Peixe', category: 'fish' },
  { prefix: 'Sopa', category: 'soup' },
];

export function parseMenuLine(line: string): MenuItem {
  for (const mapping of CATEGORY_MAPPINGS) {
    const regex = new RegExp(`^${mapping.prefix}\\s*-\\s*(.+)$`, 'iu');
    const match = line.match(regex);
    if (!match) continue;

    return {
      category: mapping.category,
      sourceLabel: mapping.prefix,
      text: cleanLine(match[1] ?? ''),
    };
  }

  return {
    category: 'other',
    sourceLabel: null,
    text: cleanLine(line),
  };
}
