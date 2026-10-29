import { A2uiExpressionError, parseTemplate } from './expression';
import { coerceToString, formatCurrency, formatDate, formatNumber, pluralize, resolveLocale } from './functions.format';
import { isValidationResult, type DynamicValue, type JsonValue, type ValidationResult } from './protocol';

export interface FunctionContext {
  activation: boolean;
  locale: string;
  resolve: (value: DynamicValue) => unknown;
  openUrl: (url: string) => void;
}

export type FunctionArgs = Record<string, unknown>;

export type FunctionImpl = (args: FunctionArgs, context: FunctionContext) => unknown;

const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_REGEX_LENGTH = 1_000;
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function failure(message: string): ValidationResult {
  return { valid: false, message };
}

export function isTruthyOrValid(value: unknown): boolean {
  return isValidationResult(value) ? value.valid : Boolean(value);
}

const REPEAT = new Set(['*', '+', '{']);
const BACKREFERENCE = /\\(?:[1-9]|k<)/;
const ESCAPE_OR_CLASS = /\\[\s\S]?|\[(?:\\[\s\S]?|[^\\\]])*\]?/g;

function closesRepeatedRiskyGroup(groups: boolean[], next: string): boolean {
  if (groups.pop() !== true) return false;
  if (REPEAT.has(next)) return true;
  if (groups.length > 0) groups[groups.length - 1] = true;
  return false;
}

function marksGroup(char: string, previous: string | undefined): boolean {
  return REPEAT.has(char) || char === '|' || (char === '?' && previous !== '(');
}

function hasRepeatedRiskyGroup(pattern: string): boolean {
  const shape = pattern.replace(ESCAPE_OR_CLASS, 'x');
  const groups: boolean[] = [];
  for (let i = 0; i < shape.length; i += 1) {
    const char = shape[i] ?? '';
    if (char === '(') groups.push(false);
    else if (char === ')' && closesRepeatedRiskyGroup(groups, shape[i + 1] ?? '')) return true;
    else if (groups.length > 0 && marksGroup(char, shape[i - 1])) groups[groups.length - 1] = true;
  }
  return false;
}

export function isSafeRegex(pattern: string): boolean {
  return pattern.length <= MAX_REGEX_LENGTH && !BACKREFERENCE.test(pattern) && !hasRepeatedRiskyGroup(pattern);
}

function required(args: FunctionArgs): ValidationResult {
  const v = args.value;
  const missing = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  return missing ? failure('This field is required.') : { valid: true };
}

function regex(args: FunctionArgs): ValidationResult {
  const pattern = coerceToString(args.pattern);
  if (!isSafeRegex(pattern)) throw new A2uiExpressionError(`Unsafe regex pattern: ${pattern}`);
  let compiled: RegExp;
  try {
    compiled = new RegExp(pattern);
  } catch {
    throw new A2uiExpressionError(`Invalid regex pattern: ${pattern}`);
  }
  return compiled.test(coerceToString(args.value)) ? { valid: true } : failure('Value does not match required pattern.');
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

function withinBounds(size: number, args: FunctionArgs, measure: string): ValidationResult {
  const min = optionalNumber(args.min);
  const max = optionalNumber(args.max);
  if (min !== undefined && size < min) return failure(`Minimum ${measure} is ${min}.`);
  if (max !== undefined && size > max) return failure(`Maximum ${measure} is ${max}.`);
  return { valid: true };
}

function length(args: FunctionArgs): ValidationResult {
  const v = args.value;
  return withinBounds(typeof v === 'string' || Array.isArray(v) ? v.length : 0, args, 'length');
}

function numeric(args: FunctionArgs): ValidationResult {
  const n = Number(args.value);
  if (args.value === null || args.value === undefined || args.value === '' || Number.isNaN(n))
    return failure('Value must be a valid number.');
  return withinBounds(n, args, 'value');
}

function email(args: FunctionArgs): ValidationResult {
  return typeof args.value === 'string' && EMAIL.test(args.value) ? { valid: true } : failure('Must be a valid email address.');
}

function booleanList(args: FunctionArgs, name: string): unknown[] {
  const values = args.values;
  if (!Array.isArray(values) || values.length < 2) throw new A2uiExpressionError(`${name} requires at least 2 values`);
  return values;
}

function formatStringImpl(args: FunctionArgs, context: FunctionContext): string {
  return parseTemplate(coerceToString(args.value))
    .map((part) => coerceToString(typeof part === 'object' && part !== null ? context.resolve(part) : part))
    .join('');
}

export function checkedUrl(input: unknown, base?: string): string {
  if (typeof input !== 'string' || input === '') throw new A2uiExpressionError('openUrl requires a URL.');
  let url: URL;
  try {
    url = base === undefined ? new URL(input) : new URL(input, base);
  } catch {
    throw new A2uiExpressionError(`Invalid URL specified: ${input}`);
  }
  if (!ALLOWED_URL_SCHEMES.has(url.protocol)) throw new A2uiExpressionError(`Unsupported URL scheme: ${url.protocol}`);
  return url.href;
}

export function createBasicFunctions(localeInput?: string): Record<string, FunctionImpl> {
  const locale = resolveLocale(localeInput);
  return {
    required,
    regex,
    length,
    numeric,
    email,
    formatString: formatStringImpl,
    formatNumber: (args) => formatNumber(Number(args.value), optionalNumber(args.decimals), args.grouping !== false, locale),
    formatCurrency: (args) =>
      formatCurrency(Number(args.value), args.currency, optionalNumber(args.decimals) ?? 2, args.grouping !== false, locale),
    formatDate: (args) => formatDate(args.value, args.format, locale),
    pluralize: (args) => pluralize(Number(args.value), args, locale),
    openUrl: (args, context) => {
      context.openUrl(checkedUrl(args.url));
      return null;
    },
    and: (args) => booleanList(args, 'and').every(isTruthyOrValid),
    or: (args) => booleanList(args, 'or').some(isTruthyOrValid),
    not: (args) => !isTruthyOrValid(args.value),
  };
}

export type FunctionReturn = JsonValue | ValidationResult | undefined;
