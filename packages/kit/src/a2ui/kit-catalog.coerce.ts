import { BORDER_SIDES, BORDER_STYLES, BOUND_HEX_COLOR, PADDING_SIDES, PERCENT } from '../kit-vocabulary';
import type { Size, Spacing } from '../layout';
import { BOX_RADIUS_SCALE, isColorToken, type RadiusValue } from '../tokens';

export type BorderStyle = (typeof BORDER_STYLES)[number];

export interface BorderSideSpec {
  width: number;
  color: string | undefined;
  style: BorderStyle | undefined;
}

export type BorderSpec = Partial<Record<(typeof BORDER_SIDES)[number], BorderSideSpec>>;

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

export function colorValueOf(value: unknown): string | undefined {
  return typeof value === 'string' && (isColorToken(value) || BOUND_HEX_COLOR.test(value)) ? value : undefined;
}

function sizeOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function lengthOf(value: unknown): Size | undefined {
  return typeof value === 'string' && PERCENT.test(value) ? value : sizeOf(value);
}

export function spacingOf(value: unknown): number | Spacing | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return sizeOf(value);
  const sides = Object.entries(value).filter(([side]) => (PADDING_SIDES as readonly string[]).includes(side));
  const spacing = Object.fromEntries(sides.flatMap(([side, size]) => (sizeOf(size) === undefined ? [] : [[side, size]])));
  return Object.keys(spacing).length === 0 ? undefined : spacing;
}

const RADII = Object.keys(BOX_RADIUS_SCALE) as RadiusValue[];

export function radiusOf(value: unknown): RadiusValue | number | undefined {
  const pixels = asNumber(value);
  return pixels !== undefined && pixels >= 0 ? pixels : asEnum(value, RADII);
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function borderSideOf(value: unknown): BorderSideSpec | undefined {
  const spec = recordOf(value) ?? { size: value };
  const width = sizeOf(spec.size);
  if (width === undefined) return undefined;
  return { width, color: colorValueOf(spec.color), style: asEnum(spec.style, BORDER_STYLES) };
}

export function borderSpecOf(value: unknown): BorderSpec | undefined {
  const record = recordOf(value);
  if (record !== undefined && BORDER_SIDES.some((side) => record[side] !== undefined)) {
    const sides = Object.fromEntries(
      BORDER_SIDES.flatMap((side) => {
        const resolved = borderSideOf(record[side]);
        return resolved === undefined ? [] : [[side, resolved]];
      }),
    );
    return Object.keys(sides).length === 0 ? undefined : sides;
  }
  const side = borderSideOf(value);
  return side === undefined ? undefined : { top: side, right: side, bottom: side, left: side };
}
