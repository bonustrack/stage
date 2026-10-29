import type { DataBinding, DynamicValue, FunctionCall, JsonObject, JsonValue } from './protocol';

export const MAX_TEMPLATE_LENGTH = 10_000;
export const MAX_TEMPLATE_PARTS = 1_000;
export const MAX_EXPRESSION_DEPTH = 100;

export class A2uiExpressionError extends Error {
  override readonly name = 'A2uiExpressionError';
}

export type TemplatePart = string | DataBinding | FunctionCall | JsonValue;

const NUMBER_LITERAL = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const NUMBER_START = /[+-]?\.?[0-9]/y;
const NUMBER_TEXT = /[+-]?[0-9.]*(?:[eE][+-]?[0-9]*)?/y;
const KEYWORD = /(?:true|false|null)(?!\p{XID_Continue})/uy;
const KEYWORDS: Record<string, DynamicValue> = { true: true, false: false, null: '' };
const NAME = /\p{XID_Continue}*/uy;
const PATH = /[\p{XID_Continue}/.@-]*/uy;
const SPACE = /\s*/y;

class Scanner {
  pos = 0;
  constructor(readonly input: string) {}

  atEnd(): boolean {
    return this.pos >= this.input.length;
  }

  peek(): string {
    const code = this.input.codePointAt(this.pos);
    return code === undefined ? '\0' : String.fromCodePoint(code);
  }

  advance(count?: number): string {
    const step = count ?? Math.max(1, this.peek().length);
    const out = this.input.slice(this.pos, this.pos + step);
    this.pos += step;
    return out;
  }

  startsWith(text: string): boolean {
    return this.input.startsWith(text, this.pos);
  }

  take(pattern: RegExp): string {
    pattern.lastIndex = this.pos;
    const text = pattern.exec(this.input)?.[0] ?? '';
    this.pos += text.length;
    return text;
  }

  skipSpace(): void {
    this.take(SPACE);
  }
}

function skipQuoted(scanner: Scanner, quote: string): void {
  while (!scanner.atEnd()) {
    const c = scanner.advance();
    if (c === '\\') scanner.advance();
    else if (c === quote) return;
  }
}

function interpolationBody(scanner: Scanner): string {
  const start = scanner.pos;
  let balance = 1;
  while (!scanner.atEnd() && balance > 0) {
    const c = scanner.advance();
    if (c === '{') balance += 1;
    else if (c === '}') balance -= 1;
    else if (c === "'" || c === '"') skipQuoted(scanner, c);
  }
  if (balance > 0) throw new A2uiExpressionError("Unclosed interpolation: missing '}'");
  return scanner.input.slice(start, scanner.pos - 1);
}

function stringLiteral(scanner: Scanner): string {
  const quote = scanner.advance();
  const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r' };
  let out = '';
  while (!scanner.atEnd()) {
    const c = scanner.advance();
    if (c === quote) return out;
    if (c === '\\') {
      const next = scanner.advance();
      out += escapes[next] ?? next;
    } else {
      out += c;
    }
  }
  return out;
}

function numberLiteral(scanner: Scanner): number {
  const text = scanner.take(NUMBER_TEXT);
  if (!NUMBER_LITERAL.test(text)) throw new A2uiExpressionError(`Invalid number literal: '${text}'`);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new A2uiExpressionError(`Number literal is out of range: '${text}'`);
  return value === 0 ? 0 : value;
}

function functionCall(name: string, scanner: Scanner, depth: number): FunctionCall {
  scanner.advance();
  scanner.skipSpace();
  const args: JsonObject = {};
  while (!scanner.atEnd() && scanner.peek() !== ')') {
    const argName = scanner.take(NAME);
    scanner.skipSpace();
    if (scanner.peek() !== ':') throw new A2uiExpressionError(`Expected ':' after argument name '${argName}' in function '${name}'`);
    scanner.advance();
    scanner.skipSpace();
    args[argName] = expressionAt(scanner, depth + 1);
    scanner.skipSpace();
    if (scanner.peek() === ',') {
      scanner.advance();
      scanner.skipSpace();
    }
  }
  if (scanner.peek() !== ')') throw new A2uiExpressionError(`Expected ')' after function arguments for '${name}'`);
  scanner.advance();
  return { '@call': name, args };
}

function literalAt(scanner: Scanner): DynamicValue | undefined {
  if (scanner.peek() === "'" || scanner.peek() === '"') return stringLiteral(scanner);
  NUMBER_START.lastIndex = scanner.pos;
  if (NUMBER_START.test(scanner.input)) return numberLiteral(scanner);
  return KEYWORDS[scanner.take(KEYWORD)];
}

function expressionAt(scanner: Scanner, depth: number): DynamicValue {
  if (depth > MAX_EXPRESSION_DEPTH) throw new A2uiExpressionError('Max recursion depth reached in parse');
  scanner.skipSpace();
  if (scanner.atEnd()) return '';
  if (scanner.startsWith('${')) {
    scanner.advance(2);
    return parseExpression(interpolationBody(scanner), depth + 1);
  }
  const literal = literalAt(scanner);
  if (literal !== undefined) return literal;
  const token = scanner.take(PATH);
  scanner.skipSpace();
  if (scanner.peek() === '(') return functionCall(token, scanner, depth);
  return token === '' ? '' : { '@path': token };
}

export function parseExpression(expression: string, depth = 0): DynamicValue {
  const trimmed = expression.trim();
  if (trimmed === '') return '';
  const scanner = new Scanner(trimmed);
  const result = expressionAt(scanner, depth);
  if (!scanner.atEnd()) throw new A2uiExpressionError(`Unexpected characters at end of expression: '${scanner.input.slice(scanner.pos)}'`);
  return result;
}

function literalRun(scanner: Scanner): string {
  const start = scanner.pos;
  while (!scanner.atEnd() && !scanner.startsWith('${') && !scanner.startsWith('\\${')) scanner.advance();
  return scanner.input.slice(start, scanner.pos);
}

export function parseTemplate(input: string, depth = 0): DynamicValue[] {
  if (depth > MAX_EXPRESSION_DEPTH) throw new A2uiExpressionError('Max recursion depth reached in parse');
  if (input.length > MAX_TEMPLATE_LENGTH)
    throw new A2uiExpressionError(`Expression template length (${input.length}) exceeds maximum limit (${MAX_TEMPLATE_LENGTH})`);
  const parts: DynamicValue[] = [];
  const scanner = new Scanner(input);
  while (!scanner.atEnd()) {
    if (parts.length >= MAX_TEMPLATE_PARTS)
      throw new A2uiExpressionError(`Expression parts count exceeds maximum limit (${MAX_TEMPLATE_PARTS})`);
    if (scanner.startsWith('${')) {
      scanner.advance(2);
      parts.push(parseExpression(interpolationBody(scanner), depth + 1));
    } else if (scanner.startsWith('\\${')) {
      scanner.advance(3);
      parts.push('${');
    } else {
      parts.push(literalRun(scanner));
    }
  }
  return parts.filter((part) => part !== '');
}
