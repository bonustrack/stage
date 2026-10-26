import type { DataBinding, DynamicValue, FunctionCall, JsonObject, JsonValue } from './protocol';

export const MAX_TEMPLATE_LENGTH = 10_000;
export const MAX_TEMPLATE_PARTS = 1_000;
export const MAX_EXPRESSION_DEPTH = 100;

export class A2uiExpressionError extends Error {
  override readonly name = 'A2uiExpressionError';
}

export type TemplatePart = string | DataBinding | FunctionCall | JsonValue;

const NUMBER_LITERAL = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const ID_CONTINUE = /^\p{XID_Continue}$/u;

class Scanner {
  pos = 0;
  constructor(readonly input: string) {}

  atEnd(): boolean {
    return this.pos >= this.input.length;
  }

  peek(offset = 0): string {
    const code = this.input.codePointAt(this.pos + offset);
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

  escapedOpen(): boolean {
    return this.peek() === '\\' && this.peek(1) === '$' && this.peek(2) === '{';
  }

  skipSpace(): void {
    while (!this.atEnd() && /\s/.test(this.peek())) this.advance();
  }

  keyword(word: string): boolean {
    if (!this.startsWith(word) || isIdContinue(this.peek(word.length))) return false;
    this.advance(word.length);
    return true;
  }
}

function isIdContinue(char: string): boolean {
  return Array.from(char).length === 1 && ID_CONTINUE.test(char);
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
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

function numberStart(scanner: Scanner): boolean {
  const offset = scanner.peek() === '-' || scanner.peek() === '+' ? 1 : 0;
  if (isDigit(scanner.peek(offset))) return true;
  return scanner.peek(offset) === '.' && isDigit(scanner.peek(offset + 1));
}

function signAndDigits(scanner: Scanner): void {
  if (scanner.peek() === '-' || scanner.peek() === '+') scanner.advance();
  while (!scanner.atEnd() && (isDigit(scanner.peek()) || scanner.peek() === '.')) scanner.advance();
}

function exponent(scanner: Scanner): void {
  if (scanner.peek() !== 'e' && scanner.peek() !== 'E') return;
  scanner.advance();
  if (scanner.peek() === '+' || scanner.peek() === '-') scanner.advance();
  while (!scanner.atEnd() && isDigit(scanner.peek())) scanner.advance();
}

function numberLiteral(scanner: Scanner): number {
  const start = scanner.pos;
  signAndDigits(scanner);
  exponent(scanner);
  const text = scanner.input.slice(start, scanner.pos);
  if (!NUMBER_LITERAL.test(text)) throw new A2uiExpressionError(`Invalid number literal: '${text}'`);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new A2uiExpressionError(`Number literal is out of range: '${text}'`);
  return value === 0 ? 0 : value;
}

function scanWhile(scanner: Scanner, accept: (c: string) => boolean): string {
  const start = scanner.pos;
  while (!scanner.atEnd() && accept(scanner.peek())) scanner.advance();
  return scanner.input.slice(start, scanner.pos);
}

function functionCall(name: string, scanner: Scanner, depth: number): FunctionCall {
  scanner.advance();
  scanner.skipSpace();
  const args: JsonObject = {};
  while (!scanner.atEnd() && scanner.peek() !== ')') {
    const argName = scanWhile(scanner, isIdContinue);
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
  if (numberStart(scanner)) return numberLiteral(scanner);
  if (scanner.keyword('true')) return true;
  if (scanner.keyword('false')) return false;
  if (scanner.keyword('null')) return '';
  return undefined;
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
  const token = scanWhile(scanner, (c) => isIdContinue(c) || c === '/' || c === '.' || c === '-' || c === '@');
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
  while (!scanner.atEnd() && !scanner.startsWith('${') && !scanner.escapedOpen()) scanner.advance();
  return scanner.input.slice(start, scanner.pos);
}

export function parseTemplate(input: string, depth = 0): DynamicValue[] {
  if (depth > MAX_EXPRESSION_DEPTH) throw new A2uiExpressionError('Max recursion depth reached in parse');
  if (input.length > MAX_TEMPLATE_LENGTH) throw new A2uiExpressionError(`Expression template length (${input.length}) exceeds maximum limit (${MAX_TEMPLATE_LENGTH})`);
  if (input === '') return [];
  if (!input.includes('${')) return [input];
  const parts: DynamicValue[] = [];
  const scanner = new Scanner(input);
  while (!scanner.atEnd()) {
    if (parts.length >= MAX_TEMPLATE_PARTS) throw new A2uiExpressionError(`Expression parts count exceeds maximum limit (${MAX_TEMPLATE_PARTS})`);
    if (scanner.startsWith('${')) {
      scanner.advance(2);
      parts.push(parseExpression(interpolationBody(scanner), depth + 1));
    } else if (scanner.escapedOpen()) {
      scanner.advance(3);
      parts.push('${');
    } else {
      parts.push(literalRun(scanner));
    }
  }
  return parts.filter((part) => part !== '');
}
