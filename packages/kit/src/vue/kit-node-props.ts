import type { HeroIconName } from '../icons';
import type { Spacing } from '../layout';
import {
  resolveAlign,
  resolveBadgeStyle,
  resolveBorder,
  resolveButtonStyle,
  resolveColor,
  resolveDirection,
  resolveHeroTitlePx,
  resolveIconName as resolveIconNameCore,
  resolveJustify,
  resolveListItemStyle,
  resolveOptionalColor,
  resolveRadius,
  resolveWrap,
  type Scheme,
} from '../kit';
import type {
  BadgeFontToken,
  BadgeNode,
  BoxLayoutBase,
  ButtonNode,
  CardNode,
  Color,
  FontWeight,
  ImageNode,
  ListViewItemNode,
} from '../kit';

const FALLBACK_ICON: HeroIconName = 'questionMarkCircle';

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

export function heroTitlePx(value: string | undefined): number | undefined {
  return resolveHeroTitlePx(value);
}

const EXTENSION_TYPES = new Set([
  'Spinner',
  'Switch',
  'Tabs',
  'TextField',
  'ColorPicker',
  'AvatarStack',
  'QRCode',
  'AudioPlayer',
  'VideoPlayer',
  'FilePicker',
  'Pressable',
  'Popover',
  'Stack',
  'ScrollRow',
  'Scroll',
  'Paragraph',
  'Dialog',
]);

export function isExtensionType(type: string): boolean {
  return EXTENSION_TYPES.has(type);
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
  return resolveIconNameCore(name) ?? FALLBACK_ICON;
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
    border: resolveBorder(node.border, scheme),
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

export function buttonProps(
  node: ButtonNode,
  scheme: Scheme,
): Record<string, unknown> {
  const styled = resolveButtonStyle(node.color, node.background, scheme, {
    pressedBackground: node.pressedBackground,
    foreground: node.foreground,
  });
  const radius = resolveRadius(node.radius);
  return {
    label: node.label,
    color: styled.color,
    tintBg: styled.tintBg,
    tintFg: styled.tintFg,
    tintPressedBg: styled.tintPressedBg,
    radius: typeof radius === 'number' ? radius : undefined,
    variant: node.variant,
    styleColor: node.style,
    size: node.size,
    pill: node.pill,
    uniform: node.uniform,
    block: node.block,
    disabled: node.disabled,
    paddingX: node.paddingX,
    paddingY: node.paddingY,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
  };
}

export interface BadgeBindings {
  box: Record<string, unknown>;
  text: {
    value: string;
    size: BadgeFontToken;
    weight: FontWeight;
    color: string;
  };
}

export function badgeProps(node: BadgeNode, scheme: Scheme): BadgeBindings {
  const styled = resolveBadgeStyle(node.color, node.background, node.size, scheme);
  return {
    box: {
      padding: { x: 8, y: 2 },
      radius: node.pill === true ? 'full' : 'sm',
      background: styled.background,
    },
    text: {
      value: node.label,
      size: styled.fontToken,
      weight: node.weight ?? 'semibold',
      color: styled.foreground,
    },
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

export function listItemProps(
  node: ListViewItemNode,
  scheme: Scheme,
): Record<string, unknown> {
  const style = resolveListItemStyle(node, scheme);
  return {
    pressable: node.onClickAction !== undefined,
    gap: numeric(node.gap),
    align: node.align,
    padding: style.padding,
    border: style.border,
    pressedBackground: style.pressedBackground,
    pressedBorderColor: style.pressedBorderColor,
    showDivider: style.showDivider,
  };
}

export function dividerColor(
  value: Color | undefined,
  scheme: Scheme,
): string | undefined {
  return value === undefined ? undefined : resolveColor(value, scheme);
}
