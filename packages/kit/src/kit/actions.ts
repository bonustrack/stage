
import type { ActionConfig } from './node-fields';
import type { Scheme } from './resolve';
import { isRecord } from './validate';

export interface DispatchedAction {
  type: string;
  payload: Record<string, unknown>;
}

export type WidgetActionHandler = (
  action: DispatchedAction,
) => void | Promise<void>;

export type WidgetActionRegistry = Record<string, WidgetActionHandler>;

export type WidgetFormValues = Record<string, unknown>;

export type WidgetDataContext = Record<string, unknown>;

export interface RendererContext {
  registry: WidgetActionRegistry;
  data: WidgetDataContext;
  scheme: Scheme;
}

function basePayload(action: ActionConfig): Record<string, unknown> {
  return isRecord(action.payload) ? { ...action.payload } : {};
}

export function buildDispatchedAction(
  action: ActionConfig,
  formValues?: WidgetFormValues,
): DispatchedAction {
  return {
    type: action.type,
    payload: { ...basePayload(action), ...(formValues ?? {}) },
  };
}

export function dispatchAction(
  registry: WidgetActionRegistry,
  action: ActionConfig,
  formValues?: WidgetFormValues,
): void | Promise<void> {
  const dispatched = buildDispatchedAction(action, formValues);
  const handler = registry[dispatched.type];
  if (handler === undefined) return undefined;
  return handler(dispatched);
}

const TOKEN_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

function readPath(data: WidgetDataContext, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = data;
  for (const segment of segments) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function resolveBindingString(
  value: string,
  data: WidgetDataContext,
): string {
  return value.replace(TOKEN_PATTERN, (match, path: string) => {
    const resolved = readPath(data, path);
    if (resolved === undefined || resolved === null) return match;
    if (typeof resolved === 'string') return resolved;
    if (typeof resolved === 'number' || typeof resolved === 'boolean') {
      return String(resolved);
    }
    return match;
  });
}

function resolveValue(value: unknown, data: WidgetDataContext): unknown {
  if (typeof value === 'string') return resolveBindingString(value, data);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, data));
  if (isRecord(value)) return resolveRecord(value, data);
  return value;
}

function resolveRecord(
  node: Record<string, unknown>,
  data: WidgetDataContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of Object.keys(node)) {
    out[entry] = resolveValue(node[entry], data);
  }
  return out;
}

export function resolveBindings<T>(node: T, data: WidgetDataContext): T {
  return resolveValue(node, data) as T;
}

export type PayloadHandler = (
  payload: Record<string, unknown>,
) => void | Promise<void>;

export type PayloadHandlers = Record<string, PayloadHandler>;

export function payloadRegistry(handlers: PayloadHandlers): WidgetActionRegistry {
  const registry: WidgetActionRegistry = {};
  for (const type of Object.keys(handlers)) {
    const handler = handlers[type];
    if (handler === undefined) continue;
    registry[type] = (action) => handler(action.payload);
  }
  return registry;
}
