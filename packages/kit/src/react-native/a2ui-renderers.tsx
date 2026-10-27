import type { ReactNode } from 'react';
import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES, type ButtonSize, type ButtonVariant } from '../button.styles';
import { isChildTemplate } from '../a2ui/protocol';
import { surfaceColor, type Surface } from '../layout';
import { BOX_RADIUS_SCALE, DENSITY_SCALE, FONT_SIZE, type FontSizeName, type RadiusValue } from '../tokens';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { Column } from './column';
import { Divider } from './divider';
import { Icon, type IconName, type IconProps } from './icon';
import { Image, type ImageFit, type ImageVariant } from './image';
import { List } from './list';
import { ListView, ListViewItem } from './list-view';
import { Modal } from './modal';
import { QrCode } from './qr-code';
import { Row } from './row';
import { Spinner } from './spinner';
import { Tabs } from './tabs';
import { Text, type TextWeight } from './text';
import { Title } from './title';
import {
  asBoolean, asEnum, asNumber, asOptionalString, asString, borderOf,
  colorOf, colorValueOf, commonProps, hasMarkdown, lengthOf, spacingOf, type A2uiRenderers, type RenderContext,
} from './a2ui-context';
import { chartRenderer } from './a2ui-renderers.chart';
import { isSortableList, listBoxProps, sortableListRenderer } from './a2ui-renderers.sortable';
import { INPUT_RENDERERS, useA2uiAction } from './a2ui-renderers.inputs';

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
const IMAGE_VARIANTS = ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'] as const satisfies readonly ImageVariant[];

function iconNameOf(value: unknown): IconProps['name'] | undefined {
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

const SHRINK_TO_FIT = { flexShrink: 1 };

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
    radius: asEnum(p.radius, RADII),
    border: borderOf(ctx, p.border),
    width,
    height: lengthOf(p.height),
    minWidth: lengthOf(p.minWidth),
    minHeight: lengthOf(p.minHeight),
    maxWidth: lengthOf(p.maxWidth),
    maxHeight: lengthOf(p.maxHeight),
    aspectRatio: asNumber(p.aspectRatio),
    style: typeof width === 'string' ? SHRINK_TO_FIT : undefined,
  };
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
    />
  );
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

function A2uiButton({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const p = ctx.props;
  const label = ctx.childText(p.child);
  const press = useA2uiAction(ctx);
  return (
    <Button
      {...commonProps(ctx)}
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
      onPress={press}
    >
      {label === undefined ? ctx.child(p.child) : undefined}
    </Button>
  );
}

const buttonRenderer = (ctx: RenderContext): ReactNode => <A2uiButton ctx={ctx}/>;

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
      onPress={pressable ? () => { ctx.action(); } : undefined}
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
  Row: (ctx) => withChildren(ctx, (children) => <Row {...flexProps(ctx)}>{children}</Row>),
  Column: (ctx) => withChildren(ctx, (children) => <Column {...flexProps(ctx)}>{children}</Column>),
  List: (ctx) => (isSortableList(ctx) ? sortableListRenderer(ctx) : withChildren(ctx, (children) => (
    <List {...listBoxProps(ctx)} gap={asNumber(ctx.props.gap) ?? GAP}>
      {children}
    </List>
  ))),
  Card: (ctx) => {
    const surface = asEnum(ctx.props.surface, SURFACES);
    const background = colorOf(ctx, ctx.props.background) ?? (surface === undefined ? undefined : surfaceColor(surface, ctx.palette));
    return (
      <Card {...commonProps(ctx)} size={asEnum(ctx.props.size, ['sm', 'md', 'lg'])} padding={asNumber(ctx.props.padding)} background={background}>
        {ctx.child(ctx.props.child)}
      </Card>
    );
  },
  Tabs: tabsRenderer,
  Modal: (ctx) => (
    <Modal {...commonProps(ctx)} trigger={ctx.child(ctx.props.trigger)} title={asOptionalString(ctx.props.title)}>
      {ctx.child(ctx.props.content)}
    </Modal>
  ),
  Divider: (ctx) => (
    <Divider {...commonProps(ctx)} axis={asEnum(ctx.props.axis, ['horizontal', 'vertical'])} spacing={asNumber(ctx.props.spacing)} color={colorOf(ctx, ctx.props.color)} />
  ),
  Text: textRenderer,
  Image: imageRenderer,
  Icon: iconRenderer,
  Button: buttonRenderer,
  ...INPUT_RENDERERS,
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
  Spinner: (ctx) => <Spinner {...commonProps(ctx)} size={asNumber(ctx.props.size)} color={colorOf(ctx, ctx.props.color) ?? ctx.palette.sub} />,
  Chart: chartRenderer,
  QrCode: (ctx) => <QrCode {...commonProps(ctx)} value={asString(ctx.props.value)} size={asNumber(ctx.props.size)} color={ctx.palette.link} background={ctx.palette.bg} />,
};
