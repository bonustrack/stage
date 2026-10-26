export const DEFAULT_LOCALE = 'en-US';

export function resolveLocale(locale: string | undefined): string {
  if (locale === undefined || locale === '') return DEFAULT_LOCALE;
  try {
    return Intl.NumberFormat.supportedLocalesOf(locale).length > 0 ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
  return JSON.stringify(value) ?? '';
}

export function formatNumber(value: number, decimals: number | undefined, grouping: boolean | undefined, locale: string): string {
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping ?? true,
  }).format(value);
}

function codeLayout(value: number, currency: string, decimals: number, grouping: boolean, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', currencyDisplay: 'code',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping,
  });
  if (typeof formatter.formatToParts !== 'function') return `${currency} ${formatNumber(value, decimals, grouping, locale)}`;
  return formatter.formatToParts(value).map((part) => (part.type === 'currency' ? currency : part.value)).join('');
}

export function formatCurrency(value: number, currencyInput: unknown, decimals: number, grouping: boolean | undefined, locale: string): string {
  if (Number.isNaN(value)) return '';
  const currency = coerceToString(currencyInput).toUpperCase();
  const useGrouping = grouping ?? true;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping,
    }).format(value);
  } catch {
    return codeLayout(value, currency, decimals, useGrouping, locale);
  }
}

interface DateNames {
  monthsLong: string[];
  monthsShort: string[];
  weekdaysLong: string[];
  weekdaysShort: string[];
}

const namesCache = new Map<string, DateNames>();

function dateNames(locale: string): DateNames {
  const cached = namesCache.get(locale);
  if (cached !== undefined) return cached;
  const render = (options: Intl.DateTimeFormatOptions, dates: Date[]): string[] => {
    const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    return dates.map((d) => formatter.format(d));
  };
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2021, i, 15)));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2021, 2, 1 + i)));
  const names = {
    monthsLong: render({ month: 'long' }, months),
    monthsShort: render({ month: 'short' }, months),
    weekdaysLong: render({ weekday: 'long' }, weekdays),
    weekdaysShort: render({ weekday: 'short' }, weekdays),
  };
  namesCache.set(locale, names);
  return names;
}

const ISO_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const WRITTEN = /^([+-]?\d{4,6})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/;

interface ParsedTimestamp {
  shifted: Date;
  instant: Date;
}

function offsetMinutes(value: string): number {
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (m === null) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function roundTrips(value: string, shifted: Date): boolean {
  const w = WRITTEN.exec(value);
  if (w === null) return false;
  const field = (i: number): number | undefined => (w[i] === undefined ? undefined : Number(w[i]));
  return field(1) === shifted.getUTCFullYear()
    && field(2) === shifted.getUTCMonth() + 1
    && field(3) === shifted.getUTCDate()
    && (field(4) ?? shifted.getUTCHours()) === shifted.getUTCHours()
    && (field(5) ?? shifted.getUTCMinutes()) === shifted.getUTCMinutes()
    && (field(6) ?? shifted.getUTCSeconds()) === shifted.getUTCSeconds();
}

export function parseTimestamp(value: string): ParsedTimestamp | null {
  const instant = new Date(ISO_OFFSET.test(value) ? value : `${value}Z`);
  if (Number.isNaN(instant.getTime())) return null;
  const shifted = new Date(instant.getTime() + offsetMinutes(value) * 60_000);
  return roundTrips(value, shifted) ? { shifted, instant } : null;
}

const DATE_TOKENS = /'(?:[^']|'')*'|yyyy|YYYY|yy|MMMM|MMM|MM|M|EEEE|EEE|E|dd|d|HH|H|hh|h|mm|m|ss|s|a/g;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function tokenValue(token: string, d: Date, names: DateNames): string {
  const hours = d.getUTCHours();
  const weekday = (d.getUTCDay() + 6) % 7;
  const table: Record<string, () => string> = {
    yyyy: () => String(d.getUTCFullYear()),
    YYYY: () => String(d.getUTCFullYear()),
    yy: () => String(d.getUTCFullYear()).slice(-2),
    MMMM: () => names.monthsLong[d.getUTCMonth()] ?? '',
    MMM: () => names.monthsShort[d.getUTCMonth()] ?? '',
    MM: () => pad(d.getUTCMonth() + 1),
    M: () => String(d.getUTCMonth() + 1),
    EEEE: () => names.weekdaysLong[weekday] ?? '',
    EEE: () => names.weekdaysShort[weekday] ?? '',
    E: () => names.weekdaysShort[weekday] ?? '',
    dd: () => pad(d.getUTCDate()),
    d: () => String(d.getUTCDate()),
    HH: () => pad(hours),
    H: () => String(hours),
    hh: () => pad(hours % 12 || 12),
    h: () => String(hours % 12 || 12),
    mm: () => pad(d.getUTCMinutes()),
    m: () => String(d.getUTCMinutes()),
    ss: () => pad(d.getUTCSeconds()),
    s: () => String(d.getUTCSeconds()),
    a: () => (hours < 12 ? 'AM' : 'PM'),
  };
  const run = table[token];
  if (run !== undefined) return run();
  return token.startsWith("'") ? token.slice(1, -1).replace(/''/g, "'") : token;
}

export function formatDate(value: unknown, pattern: unknown, locale: string): string {
  if (value === null || value === undefined || value === '') return '';
  const parsed = parseTimestamp(coerceToString(value));
  if (parsed === null) return '';
  const format = typeof pattern === 'string' && pattern !== '' ? pattern : 'yyyy-MM-dd';
  if (format === 'ISO') return parsed.instant.toISOString();
  const names = dateNames(locale);
  return format.replace(DATE_TOKENS, (token) => tokenValue(token, parsed.shifted, names));
}

function pluralCategory(value: number, locale: string): string {
  if (typeof Intl.PluralRules !== 'function') return value === 1 ? 'one' : 'other';
  return new Intl.PluralRules(locale).select(value);
}

export function pluralize(value: number, forms: Record<string, unknown>, locale: string): string {
  const exact: Record<number, string> = { 0: 'zero', 1: 'one', 2: 'two' };
  const exactCategory = exact[value];
  const category = exactCategory !== undefined && forms[exactCategory] !== undefined ? exactCategory : pluralCategory(value, locale);
  return coerceToString(forms[category] ?? forms.other ?? '');
}
