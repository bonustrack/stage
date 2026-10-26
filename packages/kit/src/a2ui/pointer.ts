import { isJsonObject, type JsonObject, type JsonValue } from './protocol';

export function parsePointer(pointer: string): string[] {
  if (pointer === '' || pointer === '/') return [];
  const body = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  return body.split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function formatPointer(tokens: readonly string[]): string {
  if (tokens.length === 0) return '/';
  return `/${tokens.map((token) => token.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

export function resolveScopedPath(path: string, scope: string): string {
  if (path.startsWith('/')) return path;
  if (path === '' || path === '.') return scope;
  const base = scope === '/' ? '' : scope;
  return `${base}/${path}`;
}

const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;

function childOf(container: JsonValue | undefined, token: string): JsonValue | undefined {
  if (Array.isArray(container)) return ARRAY_INDEX.test(token) ? container[Number(token)] : undefined;
  if (isJsonObject(container)) return Object.prototype.hasOwnProperty.call(container, token) ? container[token] : undefined;
  return undefined;
}

export function getAt(root: JsonValue | undefined, pointer: string): JsonValue | undefined {
  return parsePointer(pointer).reduce<JsonValue | undefined>(childOf, root);
}

function cloneContainer(value: JsonValue | undefined, token: string): JsonObject | JsonValue[] {
  if (Array.isArray(value)) return [...value];
  if (isJsonObject(value)) return { ...value };
  return ARRAY_INDEX.test(token) ? [] : {};
}

function writeArray(container: JsonValue[], token: string, value: JsonValue | undefined): JsonValue[] {
  const index = token === '-' ? container.length : ARRAY_INDEX.test(token) ? Number(token) : -1;
  if (index < 0 || index > container.length) return container;
  if (value === undefined) container.splice(index, 1);
  else container[index] = value;
  return container;
}

function writeChild(container: JsonObject | JsonValue[], token: string, value: JsonValue | undefined): JsonObject | JsonValue[] {
  if (Array.isArray(container)) return writeArray(container, token, value);
  if (value === undefined) return Object.fromEntries(Object.entries(container).filter(([key]) => key !== token));
  container[token] = value;
  return container;
}

function setTokens(node: JsonValue | undefined, tokens: readonly string[], value: JsonValue | undefined): JsonValue | undefined {
  const [head, ...rest] = tokens;
  if (head === undefined) return value;
  return writeChild(cloneContainer(node, head), head, setTokens(childOf(node, head), rest, value));
}

export function setAt(root: JsonObject, pointer: string, value: JsonValue | undefined): JsonObject {
  const next = setTokens(root, parsePointer(pointer), value);
  return isJsonObject(next) ? next : {};
}
