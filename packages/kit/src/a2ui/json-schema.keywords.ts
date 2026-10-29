import { isJsonObject, type JsonObject, type JsonValue } from './protocol';

export function jsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (isJsonObject(a) && isJsonObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && jsonEqual(a[key], b[key]));
  }
  return false;
}

function typeOf(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(expected: string, value: JsonValue): boolean {
  return expected === 'integer' ? typeof value === 'number' && Number.isInteger(value) : expected === typeOf(value);
}

export function checkType(type: JsonValue | undefined, value: JsonValue): string | undefined {
  if (type === undefined) return undefined;
  const allowed = (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string');
  if (allowed.some((t) => matchesType(t, value))) return undefined;
  return `Expected ${allowed.join(' or ')}, got ${typeOf(value)}.`;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(z|[+-]\d{2}(?::?\d{2})?)?$/i;
const URI = /^[a-z][a-z0-9+.-]*:[^\s]*$/i;

function isDate(value: string): boolean {
  const m = DATE.exec(value);
  if (m === null) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= days;
}

function isTime(value: string, requireZone: boolean): boolean {
  const m = TIME.exec(value);
  if (m === null) return false;
  if (requireZone && m[4] === undefined) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59 && Number(m[3]) <= 60;
}

function isDateTime(value: string): boolean {
  const parts = value.split(/[tT ]/);
  const [date, time] = parts;
  return parts.length === 2 && date !== undefined && time !== undefined && isDate(date) && isTime(time, true);
}

const FORMATS: Record<string, (value: string) => boolean> = {
  date: isDate,
  time: (value) => isTime(value, false),
  'date-time': isDateTime,
  uri: (value) => URI.test(value),
};

export function patternMatches(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, 'u').test(value);
  } catch {
    return new RegExp(pattern).test(value);
  }
}

function checkFormat(schema: JsonObject, value: string): string[] {
  const name = typeof schema.format === 'string' ? schema.format : undefined;
  const format = name === undefined ? undefined : FORMATS[name];
  return format !== undefined && !format(value) ? [`Expected a value in ${String(name)} format.`] : [];
}

function checkLength(schema: JsonObject, value: string): string[] {
  const length = Array.from(value).length;
  const out: string[] = [];
  if (typeof schema.minLength === 'number' && length < schema.minLength) out.push(`Expected at least ${schema.minLength} characters.`);
  if (typeof schema.maxLength === 'number' && length > schema.maxLength) out.push(`Expected at most ${schema.maxLength} characters.`);
  return out;
}

export function checkString(schema: JsonObject, value: JsonValue): string[] {
  if (typeof value !== 'string') return [];
  const pattern =
    typeof schema.pattern === 'string' && !patternMatches(schema.pattern, value) ? [`Expected a value matching ${schema.pattern}.`] : [];
  return [...pattern, ...checkFormat(schema, value), ...checkLength(schema, value)];
}

export function checkNumber(schema: JsonObject, value: JsonValue): string[] {
  if (typeof value !== 'number') return [];
  const out: string[] = [];
  if (typeof schema.minimum === 'number' && value < schema.minimum) out.push(`Expected a number >= ${schema.minimum}.`);
  if (typeof schema.maximum === 'number' && value > schema.maximum) out.push(`Expected a number <= ${schema.maximum}.`);
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum)
    out.push(`Expected a number > ${schema.exclusiveMinimum}.`);
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum)
    out.push(`Expected a number < ${schema.exclusiveMaximum}.`);
  return out;
}

function hasDuplicates(items: readonly JsonValue[]): boolean {
  return items.some((item, i) => items.slice(i + 1).some((other) => jsonEqual(item, other)));
}

export function checkArray(schema: JsonObject, value: JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  if (typeof schema.minItems === 'number' && value.length < schema.minItems) out.push(`Expected at least ${schema.minItems} items.`);
  if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) out.push(`Expected at most ${schema.maxItems} items.`);
  if (schema.uniqueItems === true && hasDuplicates(value)) out.push('Expected unique items.');
  return out;
}
