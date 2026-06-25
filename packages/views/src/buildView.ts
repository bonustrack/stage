import type { WidgetNode } from '@stage-labs/kit/kit';

export type JsonView = unknown;

type Scope = Record<string, unknown>;

const EXACT_TOKEN = /^\{\{\s*([\w.]+)\s*\}\}$/;
const TOKEN_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPath(scope: Scope, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = scope;
  for (const segment of segments) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function resolveString(value: string, scope: Scope): unknown {
  const exact = EXACT_TOKEN.exec(value);
  if (exact?.[1] !== undefined) return readPath(scope, exact[1]);
  return value.replace(TOKEN_PATTERN, (match, path: string) => {
    const resolved = readPath(scope, path);
    if (resolved === undefined || resolved === null) return match;
    if (
      typeof resolved === 'string' ||
      typeof resolved === 'number' ||
      typeof resolved === 'boolean'
    ) {
      return String(resolved);
    }
    return match;
  });
}

function isOmitted(value: unknown): boolean {
  return value === undefined || value === null;
}

function resolveValue(value: unknown, scope: Scope): unknown {
  if (typeof value === 'string') return resolveString(value, scope);
  if (Array.isArray(value)) return resolveArray(value, scope);
  if (isRecord(value)) return resolveNode(value, scope);
  return value;
}

function resolveArray(items: unknown[], scope: Scope): unknown[] {
  const out: unknown[] = [];
  for (const item of items) {
    if (isRecord(item) && typeof item.$repeat === 'string') {
      out.push(...expandRepeat(item, item.$repeat, scope));
      continue;
    }
    if (isRecord(item) && typeof item.$if === 'string') {
      if (isOmitted(readPath(scope, item.$if))) continue;
    }
    const resolved = resolveValue(item, scope);
    if (isOmitted(resolved)) continue;
    out.push(resolved);
  }
  return out;
}

function expandRepeat(node: Record<string, unknown>, path: string, scope: Scope): unknown[] {
  const list = readPath(scope, path);
  if (!Array.isArray(list)) return [];
  const template = node.$item;
  const out: unknown[] = [];
  list.forEach((element, index) => {
    const itemScope: Scope = { ...scope, item: element, index };
    if (Array.isArray(template)) {
      out.push(...resolveArray(template, itemScope));
      return;
    }
    const resolved = resolveValue(template, itemScope);
    if (!isOmitted(resolved)) out.push(resolved);
  });
  return out;
}

function resolveNode(node: Record<string, unknown>, scope: Scope): unknown {
  if (typeof node.$if === 'string' && isOmitted(readPath(scope, node.$if))) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    if (key === '$if' || key === '$repeat' || key === '$item') continue;
    const resolved = resolveValue(node[key], scope);
    if (isOmitted(resolved)) continue;
    out[key] = resolved;
  }
  return out;
}

export function buildView(
  view: JsonView,
  params: Record<string, unknown>,
): WidgetNode {
  return resolveValue(view, params) as WidgetNode;
}

export function buildViewList(
  view: JsonView,
  params: Record<string, unknown>,
): WidgetNode[] {
  const resolved = resolveValue(view, params);
  return Array.isArray(resolved) ? (resolved as WidgetNode[]) : [];
}
