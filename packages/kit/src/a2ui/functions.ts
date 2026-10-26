import { A2uiExpressionError, parseTemplate } from './expression';
import {
  coerceToString, formatCurrency, formatDate, formatNumber, pluralize, resolveLocale,
} from './functions.format';
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
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/;
const MAX_REGEX_LENGTH = 1_000;
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function failure(message: string): ValidationResult {
  return { valid: false, message };
}

export function isTruthyOrValid(value: unknown): boolean {
  if (isValidationResult(value)) return value.valid;
  return Boolean(value);
}

export function isSafeRegex(pattern: string): boolean {
  return pattern.length <= MAX_REGEX_LENGTH && !NESTED_QUANTIFIER.test(pattern);
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

function length(args: FunctionArgs): ValidationResult {
  const v = args.value;
  const size = typeof v === 'string' || Array.isArray(v) ? v.length : 0;
  const min = optionalNumber(args.min);
  const max = optionalNumber(args.max);
  if (min !== undefined && size < min) return failure(`Minimum length is ${min}.`);
  if (max !== undefined && size > max) return failure(`Maximum length is ${max}.`);
  return { valid: true };
}

function numeric(args: FunctionArgs): ValidationResult {
  const n = Number(args.value);
  if (args.value === null || args.value === undefined || args.value === '' || Number.isNaN(n)) return failure('Value must be a valid number.');
  const min = optionalNumber(args.min);
  const max = optionalNumber(args.max);
  if (min !== undefined && n < min) return failure(`Minimum value is ${min}.`);
  if (max !== undefined && n > max) return failure(`Maximum value is ${max}.`);
  return { valid: true };
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
  const template = typeof args.value === 'string' ? args.value : coerceToString(args.value);
  return parseTemplate(template).map((part) => coerceToString(typeof part === 'object' && part !== null ? context.resolve(part) : part)).join('');
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

function numberArg(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
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
    formatNumber: (args) => formatNumber(numberArg(args.value), optionalNumber(args.decimals), typeof args.grouping === 'boolean' ? args.grouping : undefined, locale),
    formatCurrency: (args) => formatCurrency(numberArg(args.value), args.currency, optionalNumber(args.decimals) ?? 2, typeof args.grouping === 'boolean' ? args.grouping : undefined, locale),
    formatDate: (args) => formatDate(args.value, args.format, locale),
    pluralize: (args) => pluralize(numberArg(args.value), args, locale),
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
