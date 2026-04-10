import { DateTime } from 'luxon';

export const LISBON_TIMEZONE = 'Europe/Lisbon';

export function nowInLisbon(): DateTime {
  return DateTime.now().setZone(LISBON_TIMEZONE);
}

export function getTodayIsoDate(): string {
  return nowInLisbon().toISODate() ?? DateTime.now().toISODate() ?? '';
}

export function parseIsoDate(value: string): DateTime {
  return DateTime.fromISO(value, { zone: LISBON_TIMEZONE });
}

export function diffDaysInclusive(from: string, to: string): number {
  const fromDate = parseIsoDate(from).startOf('day');
  const toDate = parseIsoDate(to).startOf('day');

  return Math.floor(toDate.diff(fromDate, 'days').days) + 1;
}

export function englishWeekdayFromIso(value: string): string {
  return parseIsoDate(value).setLocale('en').toFormat('cccc').toLowerCase();
}

export function portugueseWeekdayFromIso(value: string): string {
  return parseIsoDate(value).setLocale('pt-PT').toFormat('cccc').toLowerCase();
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value).isValid;
}
