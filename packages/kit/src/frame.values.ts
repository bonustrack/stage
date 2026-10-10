import { colors, type KitPalette, type Scheme } from './tokens';

export type Validator<T> = (raw: unknown) => T | undefined;

export const FRAME_SPACING_UNIT = 4;

export const FRAME_MAX_TEXT = 8000;

const MAX_LABEL = 200;
const MAX_ACTION_TYPE = 120;
const MAX_URL = 2048;
const MAX_PX = 2000;
const MAX_OPTIONS = 100;

export type FramePaletteKey = keyof KitPalette;

export type FrameColor =
  | { palette: FramePaletteKey }
  | { fixed: string }
  | { light: string; dark: string };

export interface FrameSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface FrameBorderSide {
  width: number;
  color?: FrameColor;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface FrameBorder {
  top?: FrameBorderSide;
  right?: FrameBorderSide;
  bottom?: FrameBorderSide;
  left?: FrameBorderSide;
}

type FrameActionHandlerKind = 'client' | 'server';

export interface FrameAction {
  type: string;
  payload?: Record<string, unknown>;
  handler?: FrameActionHandlerKind;
}

export interface FrameOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

export function str(max = MAX_LABEL): Validator<string> {
  return (raw) => (typeof raw === 'string' ? raw.slice(0, max) : undefined);
}

export const label = str();
export const fieldName = str(120);
export const text = str(FRAME_MAX_TEXT);

export const bool: Validator<boolean> = (raw) => (typeof raw === 'boolean' ? raw : undefined);

export function oneOf<const T extends string>(values: readonly T[]): Validator<T> {
  const allowed = new Set<string>(values);
  return (raw) => (typeof raw === 'string' && allowed.has(raw) ? (raw as T) : undefined);
}

export function int(min: number, max: number): Validator<number> {
  return (raw) => (typeof raw === 'number' && Number.isFinite(raw)
    ? Math.min(max, Math.max(min, Math.round(raw)))
    : undefined);
}

function clampPx(n: number): number {
  return Math.min(MAX_PX, Math.max(0, n));
}

function pxOfString(raw: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(raw.trim());
  return m?.[1] === undefined ? undefined : clampPx(Number(m[1]));
}

export const space: Validator<number> = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return clampPx(raw * FRAME_SPACING_UNIT);
  return typeof raw === 'string' ? pxOfString(raw) : undefined;
};

export const px: Validator<number> = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return clampPx(raw);
  return typeof raw === 'string' ? pxOfString(raw) : undefined;
};

export const length: Validator<number | string> = (raw) => {
  if (typeof raw === 'string' && /^\d{1,3}(?:\.\d+)?%$/.test(raw.trim())) return raw.trim();
  return px(raw);
};

export const ratio: Validator<number> = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.min(10, Math.max(0.1, raw));
  if (typeof raw !== 'string') return undefined;
  const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(raw.trim());
  const a = Number(m?.[1]);
  const b = Number(m?.[2]);
  return a > 0 && b > 0 ? ratio(a / b) : undefined;
};

export const padding: Validator<FrameSpacing> = (raw) => {
  const all = space(raw);
  if (all !== undefined) return { top: all, right: all, bottom: all, left: all };
  if (!isRecord(raw)) return undefined;
  const x = space(raw.x);
  const y = space(raw.y);
  return {
    top: space(raw.top) ?? y,
    right: space(raw.right) ?? x,
    bottom: space(raw.bottom) ?? y,
    left: space(raw.left) ?? x,
  };
};

const PALETTE_TOKENS: Record<string, FramePaletteKey> = {
  prose: 'link', primary: 'link', emphasis: 'link', secondary: 'sub', tertiary: 'sub',
  success: 'success', danger: 'danger', text: 'text', muted: 'sub', link: 'link', border: 'border',
  surface: 'bg', 'surface-secondary': 'inputBg', 'surface-tertiary': 'border',
  'surface-elevated': 'inputBg', 'surface-elevated-secondary': 'border',
  default: 'border', subtle: 'border', strong: 'sub',
};

const FIXED_TOKENS: Record<string, string> = { warning: colors.warn, caution: colors.warn };

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(?:rgba?|hsla?)\(\s*[\d.\s,/%+-]+\)$/i;

export function cssColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (v === 'transparent' || HEX.test(v) || (v.length <= 64 && FUNCTIONAL.test(v))) return v;
  return undefined;
}

export const color: Validator<FrameColor> = (raw) => {
  if (isRecord(raw)) {
    const light = cssColor(raw.light);
    const dark = cssColor(raw.dark);
    return light !== undefined && dark !== undefined ? { light, dark } : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  if (Object.hasOwn(PALETTE_TOKENS, raw)) return { palette: PALETTE_TOKENS[raw] ?? 'text' };
  if (Object.hasOwn(FIXED_TOKENS, raw)) return { fixed: FIXED_TOKENS[raw] ?? colors.warn };
  const css = cssColor(raw);
  return css === undefined ? undefined : { fixed: css };
};

export function resolveFrameColor(c: FrameColor | undefined, scheme: Scheme, palette: KitPalette): string | undefined {
  if (c === undefined) return undefined;
  if ('palette' in c) return palette[c.palette];
  if ('fixed' in c) return c.fixed;
  return c[scheme];
}

export const httpsUrl: Validator<string> = (raw) => {
  if (typeof raw !== 'string' || raw.length > MAX_URL) return undefined;
  return /^https:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i.test(raw) ? raw : undefined;
};

const ACTION_HANDLER = oneOf<FrameActionHandlerKind>(['client', 'server']);

export const action: Validator<FrameAction> = (raw) => {
  if (!isRecord(raw)) return undefined;
  const type = typeof raw.type === 'string' ? raw.type.trim().slice(0, MAX_ACTION_TYPE) : '';
  if (type === '') return undefined;
  const handler = ACTION_HANDLER(raw.handler);
  const base: FrameAction = isRecord(raw.payload) ? { type, payload: raw.payload } : { type };
  return handler === undefined ? base : { ...base, handler };
};

export const options: Validator<FrameOption[]> = (raw) => {
  if (!Array.isArray(raw)) return undefined;
  const out: FrameOption[] = [];
  for (const o of raw.slice(0, MAX_OPTIONS)) {
    if (!isRecord(o) || typeof o.value !== 'string') continue;
    const name = label(o.label) ?? o.value;
    out.push(o.disabled === true ? { label: name, value: o.value, disabled: true } : { label: name, value: o.value });
  }
  return out;
};

const BORDER_STYLE = oneOf(['solid', 'dashed', 'dotted']);

function borderSide(raw: unknown): FrameBorderSide | undefined {
  const width = px(raw);
  if (width !== undefined) return { width };
  if (!isRecord(raw)) return undefined;
  const size = px(raw.size);
  if (size === undefined) return undefined;
  return { width: size, color: color(raw.color), style: BORDER_STYLE(raw.style) };
}

export const border: Validator<FrameBorder> = (raw) => {
  const all = borderSide(raw);
  if (all !== undefined) return { top: all, right: all, bottom: all, left: all };
  if (!isRecord(raw)) return undefined;
  const x = borderSide(raw.x);
  const y = borderSide(raw.y);
  return {
    top: borderSide(raw.top) ?? y,
    right: borderSide(raw.right) ?? x,
    bottom: borderSide(raw.bottom) ?? y,
    left: borderSide(raw.left) ?? x,
  };
};

export interface FrameCardAction {
  label: string;
  action: FrameAction;
}

export const cardAction: Validator<FrameCardAction> = (raw) => {
  if (!isRecord(raw)) return undefined;
  const name = label(raw.label);
  const act = action(raw.action);
  return name !== undefined && act !== undefined ? { label: name, action: act } : undefined;
};

export const status: Validator<string> = (raw) => (isRecord(raw) ? label(raw.text) : undefined);

export interface FrameEditable {
  name: string;
  placeholder?: string;
  required?: boolean;
}

export const editable: Validator<FrameEditable> = (raw) => {
  if (!isRecord(raw)) return undefined;
  const name = fieldName(raw.name);
  if (name === undefined || name === '') return undefined;
  return { name, placeholder: label(raw.placeholder), required: bool(raw.required) };
};
