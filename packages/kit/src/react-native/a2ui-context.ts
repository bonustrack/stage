import { createContext, type ReactNode } from 'react';
import type { A2uiClient, DispatchResult } from '../a2ui/client';
import type { Scope } from '../a2ui/evaluate';
import type { ComponentInstance, JsonValue, ValidationResult } from '../a2ui/protocol';
import { resolvePaletteColor, type KitPalette } from '../tokens';
import type { A2uiAccessibility } from './a2ui-props';

export interface Binding<T> {
  value: T | undefined;
  set: (value: T) => void;
}

export interface RenderContext {
  id: string;
  instance: ComponentInstance;
  props: Record<string, unknown>;
  accessibility: A2uiAccessibility | undefined;
  weight: number | undefined;
  scope: Scope;
  dark: boolean;
  palette: KitPalette;
  contentColor: string | undefined;
  checks: ValidationResult[];
  touched: boolean;
  disabled: boolean;
  mediaUrl: (value: unknown) => string;
  child: (id: unknown) => ReactNode;
  children: (list: unknown) => ReactNode[];
  childText: (id: unknown) => string | undefined;
  action: () => DispatchResult | undefined;
  binding: <T extends JsonValue>(prop: string) => Binding<T>;
}

export type A2uiRenderer = (ctx: RenderContext) => ReactNode;

export type A2uiRenderers = Record<string, A2uiRenderer>;

export interface SurfaceContextValue {
  client: A2uiClient;
  surfaceId: string;
  renderers: A2uiRenderers;
  disabled?: boolean;
  mediaUrl?: (url: string) => string;
  onActionError?: (message: string) => void;
}

export const SurfaceContext = createContext<SurfaceContextValue | null>(null);

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object' && value !== null && 'valid' in value) return value.valid === true;
  return undefined;
}

export function asEnum<const T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function commonProps(ctx: RenderContext): { weight?: number; accessibility?: A2uiAccessibility } {
  return { weight: ctx.weight, accessibility: ctx.accessibility };
}

export function colorOf(ctx: RenderContext, value: unknown): string | undefined {
  const raw = asOptionalString(value);
  return raw === undefined ? undefined : resolvePaletteColor(raw, ctx.palette);
}

const MARKDOWN = /[*_`#>[\]|~]|^\s*([-+]|\d+\.)\s/m;

export function hasMarkdown(text: string): boolean {
  return MARKDOWN.test(text);
}
