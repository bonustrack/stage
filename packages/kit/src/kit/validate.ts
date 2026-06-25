
import type { UnknownNode, WidgetNode, WidgetRoot } from './nodes';

const ROOT_TYPES = new Set(['Card', 'ListView', 'Basic']);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWidgetNode(value: unknown): value is WidgetNode {
  return isRecord(value) && typeof value.type === 'string';
}

export function isWidgetRoot(value: unknown): value is WidgetRoot {
  return isWidgetNode(value) && ROOT_TYPES.has(value.type);
}

function fallbackRoot(): WidgetRoot {
  return { type: 'Basic' };
}

export function parseWidget(json: unknown): WidgetRoot {
  if (!isWidgetNode(json)) return fallbackRoot();
  if (isWidgetRoot(json)) return json;
  const wrapped: UnknownNode = { type: 'Basic', children: json };
  return wrapped as WidgetRoot;
}

export function nodeType(value: unknown): string | undefined {
  return isWidgetNode(value) ? value.type : undefined;
}

export function asChildren(value: unknown): WidgetNode[] {
  if (Array.isArray(value)) return value.filter(isWidgetNode);
  if (isWidgetNode(value)) return [value];
  return [];
}
