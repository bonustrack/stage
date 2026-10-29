import { createContext, type ReactNode } from 'react';
import type { A2uiClient, DispatchResult } from '../a2ui/client';
import type { Scope } from '../a2ui/evaluate';
import type { ComponentInstance, JsonValue, ValidationResult } from '../a2ui/protocol';
import type { ResolvedBoxBorder, ResolvedBoxBorderSide, Size, Spacing } from '../layout';
import { isColorToken, resolvePaletteColor, type KitPalette } from '../tokens';
import type { A2uiAccessibility } from './a2ui-props';
import type { IconName, IconProps } from './icon';

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
  childComponent: (id: unknown) => string | undefined;
  action: () => DispatchResult | undefined;
  dispatch: (action: unknown) => DispatchResult | undefined;
  resolve: (value: unknown) => unknown;
  binding: <T extends JsonValue>(prop: string) => Binding<T>;
  pointer: (path: string) => string;
  read: (pointer: string) => JsonValue | undefined;
  write: (pointer: string, value: JsonValue) => void;
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

export const SortHandleContext = createContext<string | null>(null);

export function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
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

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PERCENT = /^(?:100|\d{1,2})(?:\.\d+)?%$/;
const BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;

export function colorValueOf(value: unknown): string | undefined {
  return typeof value === 'string' && (isColorToken(value) || HEX_COLOR.test(value)) ? value : undefined;
}

export function colorOf(ctx: RenderContext, value: unknown): string | undefined {
  const raw = colorValueOf(value);
  return raw === undefined ? undefined : resolvePaletteColor(raw, ctx.palette);
}

function sizeOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function lengthOf(value: unknown): Size | undefined {
  return typeof value === 'string' && PERCENT.test(value) ? value : sizeOf(value);
}

export function spacingOf(value: unknown): number | Spacing | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return sizeOf(value);
  const sides = Object.entries(value).filter(([side]) => ['top', 'right', 'bottom', 'left', 'x', 'y'].includes(side));
  const spacing = Object.fromEntries(sides.flatMap(([side, size]) => (sizeOf(size) === undefined ? [] : [[side, size]])));
  return Object.keys(spacing).length === 0 ? undefined : spacing;
}

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

function borderSideOf(ctx: RenderContext, value: unknown): ResolvedBoxBorderSide | undefined {
  const spec = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : { size: value };
  const width = sizeOf(spec.size);
  if (width === undefined) return undefined;
  return { width, color: colorOf(ctx, spec.color) ?? ctx.palette.border, style: asEnum(spec.style, BORDER_STYLES) };
}

export function borderOf(ctx: RenderContext, value: unknown): ResolvedBoxBorder | undefined {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  if (record !== undefined && BORDER_SIDES.some((side) => record[side] !== undefined)) {
    const sides = Object.fromEntries(
      BORDER_SIDES.flatMap((side) => {
        const resolved = borderSideOf(ctx, record[side]);
        return resolved === undefined ? [] : [[side, resolved]];
      }),
    );
    return Object.keys(sides).length === 0 ? undefined : sides;
  }
  const side = borderSideOf(ctx, value);
  return side === undefined ? undefined : { top: side, right: side, bottom: side, left: side };
}

const MARKDOWN_SYNTAX: readonly RegExp[] = [
  /(\*\*|__)(?=\S)[\s\S]*?\S\1/,
  /(?<![\w*])\*(?=[^\s*])[^*\n]*[^\s*]\*(?![\w*])/,
  /(?<![\w*])\*[^\s*]\*(?![\w*])/,
  /(?<![\w_])_(?=[^\s_])[^_\n]*[^\s_]_(?![\w_])/,
  /`[^`\n]+`/,
  /~~(?=\S)[^~\n]*\S~~/,
  /^\s{0,3}(#{1,6}\s|>\s?|[-*+]\s+\S|\d+[.)]\s+\S|```)/m,
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m,
];

export function hasMarkdown(text: string): boolean {
  return MARKDOWN_SYNTAX.some((pattern) => pattern.test(text));
}

export function iconNameOf(value: unknown): IconProps['name'] | undefined {
  if (typeof value === 'string') return value as IconName;
  if (typeof value === 'object' && value !== null && 'svgPath' in value) {
    const { svgPath } = value;
    return typeof svgPath === 'string' ? { svgPath } : undefined;
  }
  return undefined;
}
