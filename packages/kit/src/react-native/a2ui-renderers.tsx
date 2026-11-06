import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { KIT_PROPS } from '../a2ui/kit-catalog';
import { coerceProps } from '../a2ui/kit-catalog.props';
import { isChildTemplate, isEventAction, isFunctionAction } from '../a2ui/protocol';
import { DIVIDER_AXES, FLEX_ALIGNS, FLEX_JUSTIFY, IMAGE_FITS, IMAGE_VARIANTS, TEXT_VARIANTS } from '../kit-vocabulary';
import { surfaceColor } from '../layout';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { Column } from './column';
import { Divider } from './divider';
import { Icon } from './icon';
import { Image } from './image';
import { List } from './list';
import { ListView, ListViewItem } from './list-view';
import { QrCode } from './qr-code';
import { Row } from './row';
import { Spinner } from './spinner';
import { Tabs } from './tabs';
import { Text } from './text';
import { Title } from './title';
import {
  DEFAULT_GAP,
  asEnum,
  asOptionalString,
  asString,
  commonProps,
  hasMarkdown,
  iconNameOf,
  paletteColor,
  resolveBorder,
  type A2uiRenderers,
  type RenderContext,
} from './a2ui-context';
import { chartRenderer } from './a2ui-renderers.chart';
import { isSortableList, listBoxProps, sortableListRenderer } from './a2ui-renderers.sortable';
import { useA2uiAction } from './a2ui-action';
import { INPUT_RENDERERS } from './a2ui-renderers.inputs';
import { OVERLAY_RENDERERS, withLabelTooltip } from './a2ui-renderers.overlay';
import { a2uiLinkProps } from './a2ui-link';

const A2UI_ICON_SIZE = 24;
const ICON_IN_BUTTON = 16;

function iconNode(value: unknown): ReactNode {
  const name = iconNameOf(value);
  return name === undefined ? undefined : <Icon name={name} size={ICON_IN_BUTTON} />;
}

const SHRINK_TO_FIT = { flexShrink: 1 };

function opacityStyle(opacity: number | undefined): { opacity: number } | undefined {
  return opacity === undefined ? undefined : { opacity: Math.max(0, Math.min(1, opacity)) };
}

function flexStyle(shrink: boolean, opacity: number | undefined): ViewStyle | undefined {
  if (opacity === undefined) return shrink ? SHRINK_TO_FIT : undefined;
  const faded = Math.max(0, Math.min(1, opacity));
  return shrink ? { ...SHRINK_TO_FIT, opacity: faded } : { opacity: faded };
}

function flexProps(ctx: RenderContext) {
  const { opacity, feedback, background, border, gap, ...kit } = coerceProps(KIT_PROPS.Row, ctx.props);
  return {
    ...commonProps(ctx),
    ...kit,
    justify: asEnum(ctx.props.justify, FLEX_JUSTIFY),
    align: asEnum(ctx.props.align, FLEX_ALIGNS),
    gap: gap ?? DEFAULT_GAP,
    background: paletteColor(ctx, background),
    border: resolveBorder(ctx, border),
    style: flexStyle(typeof kit.width === 'string', opacity),
    feedback,
  };
}

function A2uiFlex({ ctx, row = false, children }: { ctx: RenderContext; row?: boolean; children: ReactNode }): React.ReactElement {
  const act = useA2uiAction(ctx);
  const { feedback, ...box } = flexProps(ctx);
  const press =
    isEventAction(ctx.instance.action) || isFunctionAction(ctx.instance.action)
      ? {
          onPress: () => {
            act();
          },
          disabled: ctx.disabled,
          feedback,
          ...a2uiLinkProps(ctx, () => {
            act();
          }),
        }
      : {};
  const Flex = row ? Row : Column;
  return (
    <Flex {...box} {...press}>
      {children}
    </Flex>
  );
}

function withChildren(ctx: RenderContext, render: (children: ReactNode[]) => ReactNode): ReactNode {
  const children = ctx.children(ctx.props.children);
  return isChildTemplate(ctx.props.children) && children.length === 0 ? null : render(children);
}

function textRenderer(ctx: RenderContext): ReactNode {
  const text = asString(ctx.props.text);
  const { opacity, ...kit } = coerceProps(KIT_PROPS.Text, ctx.props);
  return (
    <Text
      {...commonProps(ctx)}
      {...kit}
      markdown={hasMarkdown(text)}
      text={text}
      variant={asEnum(ctx.props.variant, TEXT_VARIANTS)}
      style={opacityStyle(opacity)}
    />
  );
}

function imageRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const { opacity, background, ...kit } = coerceProps(KIT_PROPS.Image, p);
  return withLabelTooltip(
    ctx,
    <Image
      {...commonProps(ctx)}
      {...kit}
      url={ctx.mediaUrl(p.url)}
      description={asOptionalString(p.description)}
      fit={asEnum(p.fit, IMAGE_FITS)}
      variant={asEnum(p.variant, IMAGE_VARIANTS)}
      background={paletteColor(ctx, background)}
      style={opacityStyle(opacity)}
    />,
  );
}

function iconRenderer(ctx: RenderContext): ReactNode {
  const name = iconNameOf(ctx.props.name);
  if (name === undefined) return null;
  const kit = coerceProps(KIT_PROPS.Icon, ctx.props);
  const icon = (
    <Icon
      {...commonProps(ctx)}
      name={name}
      size={kit.size ?? A2UI_ICON_SIZE}
      color={paletteColor(ctx, kit.color) ?? ctx.contentColor}
      dark={ctx.dark}
      variant={kit.variant}
    />
  );
  const opacity = opacityStyle(kit.opacity);
  return withLabelTooltip(ctx, opacity === undefined ? icon : <View style={opacity}>{icon}</View>);
}

function A2uiButton({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const p = ctx.props;
  const label = ctx.childText(p.child);
  const press = useA2uiAction(ctx);
  const kit = coerceProps(KIT_PROPS.Button, p);
  return (
    <Button
      {...commonProps(ctx)}
      loading={kit.loading}
      style={opacityStyle(kit.opacity)}
      variant={kit.variant}
      color={kit.color}
      size={kit.size}
      pill={kit.pill}
      block={kit.block}
      uniform={kit.uniform}
      iconStart={iconNode(p.iconStart)}
      iconEnd={iconNode(p.iconEnd)}
      disabled={ctx.disabled || kit.disabled}
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
  const kit = coerceProps(KIT_PROPS.Title, ctx.props);
  return (
    <Title
      {...commonProps(ctx)}
      text={asString(ctx.props.text)}
      level={kit.level}
      size={kit.size}
      color={paletteColor(ctx, kit.color)}
      numberOfLines={kit.maxLines}
    />
  );
}

function listViewItemRenderer(ctx: RenderContext): ReactNode {
  const pressable = ctx.instance.action !== undefined && !ctx.disabled;
  return (
    <ListViewItem
      {...commonProps(ctx)}
      {...coerceProps(KIT_PROPS.ListViewItem, ctx.props)}
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
  return <Tabs {...commonProps(ctx)} {...coerceProps(KIT_PROPS.Tabs, ctx.props)} tabs={items} />;
}

function cardRenderer(ctx: RenderContext): ReactNode {
  const { surface, background, ...kit } = coerceProps(KIT_PROPS.Card, ctx.props);
  const fill = paletteColor(ctx, background) ?? (surface === undefined ? undefined : surfaceColor(surface, ctx.palette));
  return (
    <Card {...commonProps(ctx)} {...kit} background={fill}>
      {ctx.child(ctx.props.child)}
    </Card>
  );
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
          <List {...listBoxProps(ctx)} gap={coerceProps(KIT_PROPS.List, ctx.props).gap ?? DEFAULT_GAP}>
            {children}
          </List>
        )),
  Card: cardRenderer,
  Tabs: tabsRenderer,
  Divider: (ctx) => {
    const kit = coerceProps(KIT_PROPS.Divider, ctx.props);
    return (
      <Divider
        {...commonProps(ctx)}
        axis={asEnum(ctx.props.axis, DIVIDER_AXES)}
        spacing={kit.spacing}
        color={paletteColor(ctx, kit.color)}
      />
    );
  },
  Text: textRenderer,
  Image: imageRenderer,
  Icon: iconRenderer,
  Button: buttonRenderer,
  ...INPUT_RENDERERS,
  ...OVERLAY_RENDERERS,
  Title: titleRenderer,
  Badge: (ctx) => <Badge {...commonProps(ctx)} {...coerceProps(KIT_PROPS.Badge, ctx.props)} label={asString(ctx.props.label)} />,
  ListView: (ctx) => {
    const status = asOptionalString(ctx.props.status);
    return (
      <ListView
        {...commonProps(ctx)}
        limit={coerceProps(KIT_PROPS.ListView, ctx.props).limit}
        status={status === undefined ? undefined : { text: status }}
      >
        {ctx.children(ctx.props.children)}
      </ListView>
    );
  },
  ListViewItem: listViewItemRenderer,
  Spinner: (ctx) => {
    const kit = coerceProps(KIT_PROPS.Spinner, ctx.props);
    return <Spinner {...commonProps(ctx)} size={kit.size} color={paletteColor(ctx, kit.color) ?? ctx.palette.sub} />;
  },
  Chart: chartRenderer,
  QrCode: (ctx) => (
    <QrCode
      {...commonProps(ctx)}
      value={asString(ctx.props.value)}
      size={coerceProps(KIT_PROPS.QrCode, ctx.props).size}
      color={ctx.palette.link}
      background={ctx.palette.bg}
    />
  ),
};
