import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES, type ButtonSize, type ButtonVariant } from '../button.styles';
import { isChildTemplate, isEventAction, isFunctionAction } from '../a2ui/protocol';
import { surfaceColor, type Surface } from '../layout';
import { BOX_RADIUS_SCALE, DENSITY_SCALE, FONT_SIZE, type FontSizeName, type RadiusValue } from '../tokens';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { Column } from './column';
import { Divider } from './divider';
import { Icon } from './icon';
import { Image, type ImageFit, type ImageVariant } from './image';
import { List } from './list';
import { ListView, ListViewItem } from './list-view';
import { QrCode } from './qr-code';
import { Row } from './row';
import { Spinner } from './spinner';
import { Tabs } from './tabs';
import { Text, type TextWeight } from './text';
import { Title } from './title';
import {
  asBoolean,
  asEnum,
  asNumber,
  asOptionalString,
  asString,
  borderOf,
  colorOf,
  colorValueOf,
  commonProps,
  hasMarkdown,
  iconNameOf,
  lengthOf,
  spacingOf,
  type A2uiRenderers,
  type RenderContext,
} from './a2ui-context';
import { chartRenderer } from './a2ui-renderers.chart';
import { isSortableList, listBoxProps, sortableListRenderer } from './a2ui-renderers.sortable';
import { INPUT_RENDERERS, useA2uiAction } from './a2ui-renderers.inputs';
import { OVERLAY_RENDERERS, withLabelTooltip } from './a2ui-renderers.overlay';
import { a2uiLinkProps } from './a2ui-link';

const GAP = DENSITY_SCALE.normal.gap;
const A2UI_ICON_SIZE = 24;
const ICON_IN_BUTTON = 16;
const JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const SURFACES = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const satisfies readonly Surface[];
const RADII = Object.keys(BOX_RADIUS_SCALE) as RadiusValue[];
const FONT_SIZES = Object.keys(FONT_SIZE) as FontSizeName[];
const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const satisfies readonly TextWeight[];
const BUTTON_VARIANTS: readonly ButtonVariant[] = ['default', 'primary', 'borderless', ...BUTTON_FILLS];
const BUTTON_SIZES = Object.keys(SIZES) as ButtonSize[];
const FITS = ['contain', 'cover', 'fill', 'none', 'scaleDown'] as const satisfies readonly ImageFit[];
const IMAGE_VARIANTS = [
  'icon',
  'avatar',
  'smallFeature',
  'mediumFeature',
  'largeFeature',
  'header',
] as const satisfies readonly ImageVariant[];

function iconNode(value: unknown): ReactNode {
  const name = iconNameOf(value);
  return name === undefined ? undefined : <Icon name={name} size={ICON_IN_BUTTON} />;
}

const SHRINK_TO_FIT = { flexShrink: 1 };

function opacityStyle(value: unknown): { opacity: number } | undefined {
  const opacity = asNumber(value);
  return opacity === undefined ? undefined : { opacity: Math.max(0, Math.min(1, opacity)) };
}

function radiusOf(value: unknown): RadiusValue | number | undefined {
  const pixels = asNumber(value);
  return pixels !== undefined && pixels >= 0 ? pixels : asEnum(value, RADII);
}

function flexStyle(shrink: boolean, opacity: number | undefined): ViewStyle | undefined {
  if (opacity === undefined) return shrink ? SHRINK_TO_FIT : undefined;
  const faded = Math.max(0, Math.min(1, opacity));
  return shrink ? { ...SHRINK_TO_FIT, opacity: faded } : { opacity: faded };
}

function flexProps(ctx: RenderContext) {
  const p = ctx.props;
  const width = lengthOf(p.width);
  return {
    ...commonProps(ctx),
    justify: asEnum(p.justify, JUSTIFY),
    align: asEnum(p.align, ALIGN),
    gap: asNumber(p.gap) ?? GAP,
    padding: spacingOf(p.padding),
    wrap: asBoolean(p.wrap),
    surface: asEnum(p.surface, SURFACES),
    background: colorOf(ctx, p.background),
    radius: radiusOf(p.radius),
    border: borderOf(ctx, p.border),
    width,
    height: lengthOf(p.height),
    minWidth: lengthOf(p.minWidth),
    minHeight: lengthOf(p.minHeight),
    maxWidth: lengthOf(p.maxWidth),
    maxHeight: lengthOf(p.maxHeight),
    aspectRatio: asNumber(p.aspectRatio),
    style: flexStyle(typeof width === 'string', asNumber(p.opacity)),
  };
}

function A2uiFlex({ ctx, row = false, children }: { ctx: RenderContext; row?: boolean; children: ReactNode }): React.ReactElement {
  const act = useA2uiAction(ctx);
  const press =
    isEventAction(ctx.instance.action) || isFunctionAction(ctx.instance.action)
      ? {
          onPress: () => {
            act();
          },
          disabled: ctx.disabled,
          feedback: asEnum(ctx.props.feedback, ['opacity', 'highlight', 'none']),
          ...a2uiLinkProps(ctx, () => {
            act();
          }),
        }
      : {};
  const Flex = row ? Row : Column;
  return (
    <Flex {...flexProps(ctx)} {...press}>
      {children}
    </Flex>
  );
}

function withChildren(ctx: RenderContext, render: (children: ReactNode[]) => ReactNode): ReactNode {
  const children = ctx.children(ctx.props.children);
  return isChildTemplate(ctx.props.children) && children.length === 0 ? null : render(children);
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
      color={colorValueOf(p.color)}
      textAlign={asEnum(p.textAlign, ['start', 'center', 'end'])}
      italic={asBoolean(p.italic)}
      lineThrough={asBoolean(p.lineThrough)}
      truncate={asBoolean(p.truncate)}
      maxLines={asNumber(p.maxLines)}
      fontFamily={asEnum(p.fontFamily, ['sans', 'head', 'mono'])}
      letterSpacing={asNumber(p.letterSpacing)}
      selectable={asBoolean(p.selectable)}
      style={opacityStyle(p.opacity)}
      textTransform={asEnum(p.textTransform, ['none', 'uppercase', 'lowercase', 'capitalize'])}
    />
  );
}

function imageRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  return withLabelTooltip(
    ctx,
    <Image
      {...commonProps(ctx)}
      url={ctx.mediaUrl(p.url)}
      description={asOptionalString(p.description)}
      fit={asEnum(p.fit, FITS)}
      variant={asEnum(p.variant, IMAGE_VARIANTS)}
      radius={radiusOf(p.radius)}
      size={asNumber(p.size)}
      width={asNumber(p.width)}
      height={asNumber(p.height)}
      aspectRatio={asNumber(p.aspectRatio)}
      background={colorOf(ctx, p.background)}
      style={opacityStyle(p.opacity)}
    />,
  );
}

function iconRenderer(ctx: RenderContext): ReactNode {
  const name = iconNameOf(ctx.props.name);
  if (name === undefined) return null;
  const color = colorOf(ctx, ctx.props.color) ?? ctx.contentColor;
  const icon = (
    <Icon
      {...commonProps(ctx)}
      name={name}
      size={asNumber(ctx.props.size) ?? A2UI_ICON_SIZE}
      color={color}
      dark={ctx.dark}
      variant={asEnum(ctx.props.variant, ['outline', 'solid'])}
    />
  );
  const opacity = opacityStyle(ctx.props.opacity);
  return withLabelTooltip(ctx, opacity === undefined ? icon : <View style={opacity}>{icon}</View>);
}

function A2uiButton({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const p = ctx.props;
  const label = ctx.childText(p.child);
  const press = useA2uiAction(ctx);
  const opacity = asNumber(p.opacity);
  return (
    <Button
      {...commonProps(ctx)}
      loading={asBoolean(p.loading)}
      style={opacityStyle(opacity)}
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
      onPress={() => {
        press();
      }}
      {...a2uiLinkProps(ctx, () => {
        press();
      })}
    >
      {label === undefined ? ctx.child(p.child) : undefined}
    </Button>
  );
}

const buttonRenderer = (ctx: RenderContext): ReactNode =>
  withLabelTooltip(ctx, <A2uiButton ctx={ctx} />, ctx.childText(ctx.props.child) === undefined);

function titleRenderer(ctx: RenderContext): ReactNode {
  const level = asNumber(ctx.props.level);
  return (
    <Title
      {...commonProps(ctx)}
      text={asString(ctx.props.text)}
      level={level === 1 || level === 2 || level === 3 ? level : undefined}
      size={asEnum(ctx.props.size, ['sm', 'md', 'lg'])}
      color={colorOf(ctx, ctx.props.color)}
      numberOfLines={asNumber(ctx.props.maxLines)}
    />
  );
}

function listViewItemRenderer(ctx: RenderContext): ReactNode {
  const pressable = ctx.instance.action !== undefined && !ctx.disabled;
  return (
    <ListViewItem
      {...commonProps(ctx)}
      gap={asNumber(ctx.props.gap)}
      align={asEnum(ctx.props.align, ['start', 'center', 'end'])}
      onPress={
        pressable
          ? () => {
              ctx.action();
            }
          : undefined
      }
    >
      {ctx.children(ctx.props.children)}
    </ListViewItem>
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

export const KIT_RENDERERS: A2uiRenderers = {
  Row: (ctx) =>
    withChildren(ctx, (children) => (
      <A2uiFlex ctx={ctx} row>
        {children}
      </A2uiFlex>
    )),
  Column: (ctx) => withChildren(ctx, (children) => <A2uiFlex ctx={ctx}>{children}</A2uiFlex>),
  List: (ctx) =>
    isSortableList(ctx)
      ? sortableListRenderer(ctx)
      : withChildren(ctx, (children) => (
          <List {...listBoxProps(ctx)} gap={asNumber(ctx.props.gap) ?? GAP}>
            {children}
          </List>
        )),
  Card: (ctx) => {
    const surface = asEnum(ctx.props.surface, SURFACES);
    const background = colorOf(ctx, ctx.props.background) ?? (surface === undefined ? undefined : surfaceColor(surface, ctx.palette));
    return (
      <Card
        {...commonProps(ctx)}
        size={asEnum(ctx.props.size, ['sm', 'md', 'lg'])}
        padding={asNumber(ctx.props.padding)}
        background={background}
      >
        {ctx.child(ctx.props.child)}
      </Card>
    );
  },
  Tabs: tabsRenderer,
  Divider: (ctx) => (
    <Divider
      {...commonProps(ctx)}
      axis={asEnum(ctx.props.axis, ['horizontal', 'vertical'])}
      spacing={asNumber(ctx.props.spacing)}
      color={colorOf(ctx, ctx.props.color)}
    />
  ),
  Text: textRenderer,
  Image: imageRenderer,
  Icon: iconRenderer,
  Button: buttonRenderer,
  ...INPUT_RENDERERS,
  ...OVERLAY_RENDERERS,
  Title: titleRenderer,
  Badge: (ctx) => (
    <Badge
      {...commonProps(ctx)}
      label={asString(ctx.props.label)}
      color={asEnum(ctx.props.color, BADGE_COLORS)}
      variant={asEnum(ctx.props.variant, BADGE_VARIANTS)}
      size={asEnum(ctx.props.size, BADGE_SIZES)}
      pill={asBoolean(ctx.props.pill)}
    />
  ),
  ListView: (ctx) => {
    const status = asOptionalString(ctx.props.status);
    return (
      <ListView {...commonProps(ctx)} limit={asNumber(ctx.props.limit)} status={status === undefined ? undefined : { text: status }}>
        {ctx.children(ctx.props.children)}
      </ListView>
    );
  },
  ListViewItem: listViewItemRenderer,
  Spinner: (ctx) => (
    <Spinner {...commonProps(ctx)} size={asNumber(ctx.props.size)} color={colorOf(ctx, ctx.props.color) ?? ctx.palette.sub} />
  ),
  Chart: chartRenderer,
  QrCode: (ctx) => (
    <QrCode
      {...commonProps(ctx)}
      value={asString(ctx.props.value)}
      size={asNumber(ctx.props.size)}
      color={ctx.palette.link}
      background={ctx.palette.bg}
    />
  ),
};
