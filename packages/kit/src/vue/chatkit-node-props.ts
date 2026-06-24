import { HERO_ICON_PATHS, type HeroIconName } from '../icons';
import type { Spacing } from '../layout';
import {
  resolveAlign,
  resolveColor,
  resolveDirection,
  resolveJustify,
  resolveOptionalColor,
  resolveRadius,
  resolveWrap,
  type Scheme,
} from '../chatkit';
import type {
  BoxLayoutBase,
  ButtonNode,
  CardNode,
  Color,
  ImageNode,
  ListViewItemNode,
} from '../chatkit';

const FALLBACK_ICON: HeroIconName = 'questionMarkCircle';

function toCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, ch: string) =>
    ch.toUpperCase(),
  );
}

export type TitleToken = 'sm' | 'md' | 'lg';
export type CaptionToken = 'sm' | 'md';
export type CaptionWeightToken = 'normal' | 'medium' | 'semibold';
export type FieldVariantToken = 'soft' | 'outline';

const TITLE_SIZE: Record<string, TitleToken> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
  '2xl': 'lg',
  '3xl': 'lg',
  '4xl': 'lg',
  '5xl': 'lg',
};

export function titleSize(value: string | undefined): TitleToken | undefined {
  return value === undefined ? undefined : (TITLE_SIZE[value] ?? 'md');
}

export function captionSize(value: string | undefined): CaptionToken | undefined {
  if (value === undefined) return undefined;
  return value === 'sm' ? 'sm' : 'md';
}

export function captionWeight(
  value: string | undefined,
): CaptionWeightToken | undefined {
  if (value === undefined) return undefined;
  return value === 'bold' ? 'semibold' : (value as CaptionWeightToken);
}

export function fieldVariant(
  value: string | undefined,
): FieldVariantToken | undefined {
  if (value === undefined) return undefined;
  return value === 'soft' ? 'soft' : 'outline';
}

export function resolveIconName(name: string): HeroIconName {
  const camel = toCamel(name);
  if (camel in HERO_ICON_PATHS) return camel as HeroIconName;
  if (name in HERO_ICON_PATHS) return name as HeroIconName;
  return FALLBACK_ICON;
}

function numeric(value: number | string | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

type BoxSpacing = number | string | Spacing | undefined;

function spacing(value: BoxLayoutBase['padding']): BoxSpacing {
  return value;
}

export function boxProps(
  node: BoxLayoutBase & { direction?: 'row' | 'col' },
  scheme: Scheme,
): Record<string, unknown> {
  return {
    direction: resolveDirection(node.direction),
    align: resolveAlign(node.align),
    justify: resolveJustify(node.justify),
    wrap: resolveWrap(node.wrap),
    gap: numeric(node.gap),
    flex: numeric(node.flex),
    width: node.width,
    height: node.height,
    size: node.size,
    minWidth: node.minWidth,
    minHeight: node.minHeight,
    maxWidth: node.maxWidth,
    maxHeight: node.maxHeight,
    aspectRatio: node.aspectRatio,
    padding: spacing(node.padding),
    margin: spacing(node.margin),
    radius: resolveRadius(node.radius),
    background: resolveOptionalColor(node.background, scheme),
  };
}

export function cardProps(
  node: CardNode,
  scheme: Scheme,
): Record<string, unknown> {
  return {
    size: node.size === 'full' ? 'lg' : node.size,
    padding: typeof node.padding === 'number' ? node.padding : undefined,
    background: resolveOptionalColor(node.background, scheme),
    collapsed: node.collapsed,
    status: node.status ? { text: node.status.text } : undefined,
    confirm: node.confirm ? { label: node.confirm.label } : undefined,
    cancel: node.cancel ? { label: node.cancel.label } : undefined,
    dark: node.theme === 'dark' ? true : undefined,
  };
}

export function buttonProps(node: ButtonNode): Record<string, unknown> {
  return {
    label: node.label,
    color: node.color,
    variant: node.variant,
    styleColor: node.style,
    size: node.size,
    pill: node.pill,
    uniform: node.uniform,
    block: node.block,
    disabled: node.disabled,
  };
}

export interface ImageBindings {
  src: string;
  [extra: string]: unknown;
}

export function imageProps(node: ImageNode, scheme: Scheme): ImageBindings {
  return {
    src: node.src,
    alt: node.alt,
    fit: node.fit,
    position: node.position,
    frame: node.frame,
    flush: node.flush,
    radius: resolveRadius(node.radius),
    width: node.width,
    height: node.height,
    size: node.size,
    minWidth: node.minWidth,
    minHeight: node.minHeight,
    maxWidth: node.maxWidth,
    maxHeight: node.maxHeight,
    aspectRatio: numeric(node.aspectRatio),
    margin: typeof node.margin === 'number' ? node.margin : undefined,
    background: resolveOptionalColor(node.background, scheme),
  };
}

export function listItemProps(node: ListViewItemNode): Record<string, unknown> {
  return {
    pressable: node.onClickAction !== undefined,
    gap: numeric(node.gap),
    align: node.align,
  };
}

export function dividerColor(
  value: Color | undefined,
  scheme: Scheme,
): string | undefined {
  return value === undefined ? undefined : resolveColor(value, scheme);
}
