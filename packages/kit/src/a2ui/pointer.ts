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

function childOf(container: JsonValue | undefined, token: string): JsonValue | undefined {
  if (Array.isArray(container)) {
    if (!/^(0|[1-9][0-9]*)$/.test(token)) return undefined;
    return container[Number(token)];
  }
  if (isJsonObject(container)) return Object.prototype.hasOwnProperty.call(container, token) ? container[token] : undefined;
  return undefined;
}

export function getAt(root: JsonValue | undefined, pointer: string): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const token of parsePointer(pointer)) {
    current = childOf(current, token);
    if (current === undefined) return undefined;
  }
  return current;
}

function emptyContainerFor(nextToken: string | undefined): JsonValue {
  return nextToken !== undefined && /^(0|[1-9][0-9]*)$/.test(nextToken) ? [] : {};
}

function cloneContainer(value: JsonValue | undefined, nextToken: string | undefined): JsonObject | JsonValue[] {
  if (Array.isArray(value)) return [...value];
  if (isJsonObject(value)) return { ...value };
  const fresh = emptyContainerFor(nextToken);
  return Array.isArray(fresh) ? fresh : {};
}

function writeArray(container: JsonValue[], token: string, value: JsonValue | undefined): JsonValue[] {
  const index = token === '-' ? container.length : Number(token);
  if (!Number.isInteger(index) || index < 0) return container;
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
  const nextChild = rest.length === 0 ? value : setTokens(childOf(node, head), rest, value);
  return writeChild(cloneContainer(node, head), head, nextChild);
}

export function setAt(root: JsonObject, pointer: string, value: JsonValue | undefined): JsonObject {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) return isJsonObject(value) ? value : {};
  const next = setTokens(root, tokens, value);
  return isJsonObject(next) ? next : {};
}
