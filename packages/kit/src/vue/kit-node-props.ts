import type { HeroIconName } from '../icons';
import type { Spacing } from '../layout';
import {
  resolveAlign,
  resolveBadgeStyle,
  resolveBorder,
  resolveButtonStyle,
  resolveColor,
  resolveCaptionSize,
  resolveCaptionWeight,
  resolveDirection,
  resolveHeroTitlePx,
  resolveIconName as resolveIconNameCore,
  resolveJustify,
  resolveListItemStyle,
  resolveOptionalColor,
  resolvePosition,
  resolveRadius,
  resolveWrap,
  hasPositioning,
  type Scheme,
} from '../kit';
import type {
  BadgeFontToken,
  BadgeNode,
  BoxLayoutBase,
  ButtonNode,
  CaptionSize,
  CardNode,
  Color,
  FontWeight,
  ImageNode,
  ListViewItemNode,
  WidgetNode,
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

export function captionSize(
  value: CaptionSize | undefined,
): CaptionToken | undefined {
  return resolveCaptionSize(value);
}

export function captionWeight(
  value: FontWeight | undefined,
): CaptionWeightToken | undefined {
  return resolveCaptionWeight(value);
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

function dimCss(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function positionStyle(box: BoxLayoutBase): Record<string, string> | undefined {
  const node = box as WidgetNode;
  if (!hasPositioning(node)) return undefined;
  const pos = resolvePosition(node);
  const css: Record<string, string> = { position: pos.position };
  const top = dimCss(pos.top);
  const right = dimCss(pos.right);
  const bottom = dimCss(pos.bottom);
  const left = dimCss(pos.left);
  if (top !== undefined) css.top = top;
  if (right !== undefined) css.right = right;
  if (bottom !== undefined) css.bottom = bottom;
  if (left !== undefined) css.left = left;
  if (pos.zIndex !== undefined) css.zIndex = String(pos.zIndex);
  return css;
}

export function boxProps(
  node: BoxLayoutBase & { direction?: 'row' | 'col' },
  scheme: Scheme,
): Record<string, unknown> {
  return {
    positionStyle: positionStyle(node),
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
