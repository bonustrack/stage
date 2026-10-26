import type { ReactNode } from 'react';
import { DENSITY_SCALE, FONT_SIZE, type RadiusValue } from '../tokens';
import { SIZES, type ButtonColor, type ButtonSize, type ButtonVariant } from '../button.styles';
import type { Surface } from '../layout';
import type { FontSizeName } from '../tokens';
import { AudioPlayer } from './audio-player';
import { Button } from './button';
import { Card } from './card';
import { Column } from './column';
import { Divider } from './divider';
import { Icon, type IconName, type IconProps } from './icon';
import { Image, type ImageFit, type ImageVariant } from './image';
import { List } from './list';
import { Modal } from './modal';
import { Row } from './row';
import { Tabs } from './tabs';
import { Text, type TextWeight } from './text';
import { Video } from './video';
import {
  asBoolean, asEnum, asNumber, asOptionalString, asString,
  colorOf, commonProps, hasMarkdown, type A2uiRenderers, type RenderContext,
} from './a2ui-context';
import { INPUT_RENDERERS } from './a2ui-renderers.inputs';
import { KIT_EXTRA_RENDERERS } from './a2ui-renderers.kit';

const GAP = DENSITY_SCALE.normal.gap;
const A2UI_ICON_SIZE = 24;
const ICON_IN_BUTTON = 16;
const JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const SURFACES = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const satisfies readonly Surface[];
const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const satisfies readonly RadiusValue[];
const FONT_SIZES = Object.keys(FONT_SIZE) as FontSizeName[];
const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const satisfies readonly TextWeight[];
const BUTTON_VARIANTS = ['default', 'primary', 'borderless', 'solid', 'soft', 'outline', 'ghost'] as const satisfies readonly ButtonVariant[];
const BUTTON_COLORS = ['primary', 'secondary', 'info', 'discovery', 'success', 'caution', 'warning', 'danger'] as const satisfies readonly ButtonColor[];
const BUTTON_SIZES = Object.keys(SIZES) as ButtonSize[];
const FITS = ['contain', 'cover', 'fill', 'none', 'scaleDown'] as const satisfies readonly ImageFit[];
const IMAGE_VARIANTS = ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'] as const satisfies readonly ImageVariant[];

export function iconNameOf(value: unknown): IconProps['name'] | undefined {
  if (typeof value === 'string') return value as IconName;
  if (typeof value === 'object' && value !== null && 'svgPath' in value) {
    const { svgPath } = value;
    return typeof svgPath === 'string' ? { svgPath } : undefined;
  }
  return undefined;
}

function iconNode(value: unknown): ReactNode {
  const name = iconNameOf(value);
  return name === undefined ? undefined : <Icon name={name} size={ICON_IN_BUTTON} />;
}

function flexProps(ctx: RenderContext) {
  const p = ctx.props;
  return {
    ...commonProps(ctx),
    justify: asEnum(p.justify, JUSTIFY),
    align: asEnum(p.align, ALIGN),
    gap: asNumber(p.gap) ?? GAP,
    padding: asNumber(p.padding),
    wrap: asBoolean(p.wrap),
    surface: asEnum(p.surface, SURFACES),
    background: colorOf(ctx, p.background),
    radius: asEnum(p.radius, RADII),
  };
}

function textRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const text = asString(p.text);
  return (
    <Text
      {...commonProps(ctx)}
      markdown={hasMarkdown(text)}
      text={text}
      variant={asEnum(p.variant, ['body', 'caption'])}
      size={asEnum(p.size, FONT_SIZES)}
      fontWeight={asEnum(p.fontWeight, WEIGHTS)}
      color={asOptionalString(p.color)}
      textAlign={asEnum(p.textAlign, ['start', 'center', 'end'])}
      italic={asBoolean(p.italic)}
      lineThrough={asBoolean(p.lineThrough)}
      truncate={asBoolean(p.truncate)}
      maxLines={asNumber(p.maxLines)}
      fontFamily={asEnum(p.fontFamily, ['sans', 'mono'])}
    />
  );
}

function videoRenderer(ctx: RenderContext): ReactNode {
  const url = ctx.mediaUrl(ctx.props.url);
  const poster = ctx.props.posterUrl === undefined ? '' : ctx.mediaUrl(ctx.props.posterUrl);
  return url === '' ? null : <Video {...commonProps(ctx)} url={url} posterUrl={poster === '' ? undefined : poster} />;
}

function imageRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  return (
    <Image
      {...commonProps(ctx)}
      url={ctx.mediaUrl(p.url)}
      description={asOptionalString(p.description)}
      fit={asEnum(p.fit, FITS)}
      variant={asEnum(p.variant, IMAGE_VARIANTS)}
      radius={asEnum(p.radius, RADII)}
      size={asNumber(p.size)}
      width={asNumber(p.width)}
      height={asNumber(p.height)}
      aspectRatio={asNumber(p.aspectRatio)}
      background={colorOf(ctx, p.background)}
    />
  );
}

function iconRenderer(ctx: RenderContext): ReactNode {
  const name = iconNameOf(ctx.props.name);
  if (name === undefined) return null;
  const color = colorOf(ctx, ctx.props.color) ?? ctx.contentColor;
  return <Icon {...commonProps(ctx)} name={name} size={asNumber(ctx.props.size) ?? A2UI_ICON_SIZE} color={color} dark={ctx.dark} variant={asEnum(ctx.props.variant, ['outline', 'solid'])} />;
}

function buttonRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const label = ctx.childText(p.child);
  return (
    <Button
      {...commonProps(ctx)}
      dark={ctx.dark}
      variant={asEnum(p.variant, BUTTON_VARIANTS)}
      color={asEnum(p.color, BUTTON_COLORS)}
      size={asEnum(p.size, BUTTON_SIZES)}
      pill={asBoolean(p.pill)}
      block={asBoolean(p.block)}
      uniform={asBoolean(p.uniform)}
      iconStart={iconNode(p.iconStart)}
      iconEnd={iconNode(p.iconEnd)}
      disabled={ctx.disabled || asBoolean(p.disabled)}
      checks={ctx.checks}
      label={label}
      onPress={() => { ctx.action(); }}
    >
      {label === undefined ? ctx.child(p.child) : undefined}
    </Button>
  );
}

function tabsRenderer(ctx: RenderContext): ReactNode {
  const tabs = Array.isArray(ctx.props.tabs) ? ctx.props.tabs : [];
  const items = tabs.map((tab: unknown) => {
    const entry = typeof tab === 'object' && tab !== null ? (tab as Record<string, unknown>) : {};
    return { title: asString(entry.title), child: ctx.child(entry.child) };
  });
  return <Tabs {...commonProps(ctx)} tabs={items} variant={asEnum(ctx.props.variant, ['segmented', 'underline'])} />;
}

const LAYOUT_RENDERERS: A2uiRenderers = {
  Row: (ctx) => <Row {...flexProps(ctx)}>{ctx.children(ctx.props.children)}</Row>,
  Column: (ctx) => <Column {...flexProps(ctx)}>{ctx.children(ctx.props.children)}</Column>,
  List: (ctx) => (
    <List {...commonProps(ctx)} direction={asEnum(ctx.props.direction, ['vertical', 'horizontal'])} align={asEnum(ctx.props.align, ALIGN)} gap={asNumber(ctx.props.gap) ?? GAP}>
      {ctx.children(ctx.props.children)}
    </List>
  ),
  Card: (ctx) => (
    <Card {...commonProps(ctx)} dark={ctx.dark} size={asEnum(ctx.props.size, ['sm', 'md', 'lg'])} padding={asNumber(ctx.props.padding)}>
      {ctx.child(ctx.props.child)}
    </Card>
  ),
  Tabs: tabsRenderer,
  Modal: (ctx) => (
    <Modal {...commonProps(ctx)} trigger={ctx.child(ctx.props.trigger)} title={asOptionalString(ctx.props.title)}>
      {ctx.child(ctx.props.content)}
    </Modal>
  ),
  Divider: (ctx) => (
    <Divider {...commonProps(ctx)} axis={asEnum(ctx.props.axis, ['horizontal', 'vertical'])} spacing={asNumber(ctx.props.spacing)} color={colorOf(ctx, ctx.props.color)} />
  ),
};

const DISPLAY_RENDERERS: A2uiRenderers = {
  Text: textRenderer,
  Image: imageRenderer,
  Icon: iconRenderer,
  Video: videoRenderer,
  AudioPlayer: (ctx) => {
    const url = ctx.mediaUrl(ctx.props.url);
    return url === '' ? null : <AudioPlayer {...commonProps(ctx)} url={url} description={asOptionalString(ctx.props.description)} dark={ctx.dark} />;
  },
  Button: buttonRenderer,
};

export const KIT_RENDERERS: A2uiRenderers = {
  ...LAYOUT_RENDERERS,
  ...DISPLAY_RENDERERS,
  ...INPUT_RENDERERS,
  ...KIT_EXTRA_RENDERERS,
};
