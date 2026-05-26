const DATE_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
})

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'short',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
})

export function toIsoDate(date: Date) {
  return ISO_DATE_FORMATTER.format(date)
}

function fromIsoDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function compactDate(value: string) {
  return DATE_FORMATTER.format(fromIsoDate(value))
}

export function shortWeekday(value: string) {
  return WEEKDAY_FORMATTER.format(fromIsoDate(value))
}

export function longDate(value: string) {
  return LONG_DATE_FORMATTER.format(fromIsoDate(value))
}
