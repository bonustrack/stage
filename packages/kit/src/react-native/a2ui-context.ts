import { createContext, type ReactNode } from 'react';
import type { A2uiClient, DispatchResult } from '../a2ui/client';
import type { Scope } from '../a2ui/evaluate';
import type { ComponentInstance, JsonValue, ValidationResult } from '../a2ui/protocol';
import { borderSpecOf, colorValueOf, type BorderSpec } from '../a2ui/kit-catalog.coerce';
import { BORDER_SIDES } from '../kit-vocabulary';
import type { ResolvedBoxBorder } from '../layout';
import { DENSITY_SCALE, resolvePaletteColor, type KitPalette } from '../tokens';
import type { A2uiAccessibility } from './a2ui-props';
import type { IconName, IconProps } from './icon';

export {
  asBoolean,
  asEnum,
  asNumber,
  asOptionalString,
  asString,
  asStringList,
  colorValueOf,
  lengthOf,
  spacingOf,
} from '../a2ui/kit-catalog.coerce';

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

export function commonProps(ctx: RenderContext): { weight?: number; accessibility?: A2uiAccessibility } {
  return { weight: ctx.weight, accessibility: ctx.accessibility };
}

export const DEFAULT_GAP = DENSITY_SCALE.normal.gap;

export function paletteColor(ctx: RenderContext, raw: string | undefined): string | undefined {
  return raw === undefined ? undefined : resolvePaletteColor(raw, ctx.palette);
}

export function colorOf(ctx: RenderContext, value: unknown): string | undefined {
  return paletteColor(ctx, colorValueOf(value));
}

export function resolveBorder(ctx: RenderContext, spec: BorderSpec | undefined): ResolvedBoxBorder | undefined {
  if (spec === undefined) return undefined;
  return Object.fromEntries(
    BORDER_SIDES.flatMap((name) => {
      const side = spec[name];
      return side === undefined
        ? []
        : [[name, { width: side.width, color: paletteColor(ctx, side.color) ?? ctx.palette.border, style: side.style }]];
    }),
  );
}

export function borderOf(ctx: RenderContext, value: unknown): ResolvedBoxBorder | undefined {
  return resolveBorder(ctx, borderSpecOf(value));
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
