import type { ArgTypes } from './story';

export interface Route {
  storyId: string | null;
  args: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const args: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(query)) args[key] = value;
  return { storyId: path || null, args };
}

export type ArgValue = string | number | boolean;

export function argToText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

export function serializeRoute(storyId: string, args: Record<string, ArgValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) params.set(key, String(value));
  const query = params.toString();
  return `#/${storyId}${query ? `?${query}` : ''}`;
}

export function coerceArg(raw: string, argType: { control: { type: string }; options?: readonly unknown[] } | undefined): unknown {
  if (!argType) return raw;
  const { type } = argType.control;
  if (type === 'boolean') return raw === 'true';
  if (type === 'number' || type === 'range') return raw === '' ? undefined : Number(raw);
  if (type === 'select') return argType.options?.find((o) => String(o) === raw) ?? raw;
  return raw;
}

export function coerceArgs(raw: Record<string, string>, argTypes: ArgTypes<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = coerceArg(value, argTypes[key]);
  return out;
}
