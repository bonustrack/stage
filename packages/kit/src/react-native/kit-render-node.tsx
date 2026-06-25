
import type { ReactNode } from 'react';
import type {
  BadgeNode,
  BoxLayoutBase,
  BoxNode,
  CaptionNode,
  CardNode,
  ChartNode,
  ColNode,
  DividerNode,
  IconNode,
  ImageNode,
  LabelNode,
  ListViewItemNode,
  ListViewNode,
  MarkdownNode,
  RowNode,
  SpacerNode,
  TextNode,
  TitleNode,
  WidgetNode,
} from '../kit';
import {
  resolveAlign,
  resolveBadgeColor,
  resolveBorder,
  resolveHeroTitlePx,
  resolveJustify,
  resolveOptionalColor,
  resolveRadius,
  resolveWrap,
} from '../kit';
import type { SpacingValue } from '../kit';
import { Box } from './box';
import { Caption } from './caption';
import { Card } from './card';
import { Divider } from './divider';
import { GesturePressable } from './gesture-pressable';
import { Icon } from './icon';
import { KitChart } from './kit-render-chart';
import { Image } from './image';
import { Label } from './label';
import { ListView, ListViewItem } from './list-view';
import { Markdown } from './markdown';
import { Spacer } from './spacer';
import { Text } from './text';
import { Title } from './title';
import {
  captionSize,
  dispatch,
  nodeKey,
  renderList,
  resolveIconName,
  textSize,
  titleSize,
  toNumber,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

const ICON_PX: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
};

function boxProps(node: BoxLayoutBase, ctx: RenderCtx): Record<string, unknown> {
  return {
    align: resolveAlign(node.align),
    justify: resolveJustify(node.justify),
    wrap: resolveWrap(node.wrap),
    gap: toNumber(node.gap),
    flex: toNumber(node.flex),
    padding: node.padding,
    margin: node.margin,
    radius: resolveRadius(node.radius),
    border: resolveBorder(node.border, ctx.scheme),
    background: resolveOptionalColor(node.background, ctx.scheme),
    width: node.width,
    height: node.height,
    size: node.size,
    minWidth: node.minWidth,
    minHeight: node.minHeight,
    maxWidth: node.maxWidth,
    maxHeight: node.maxHeight,
    aspectRatio: node.aspectRatio,
  };
}

export function renderBox(
  node: BoxNode | RowNode | ColNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const direction =
    node.type === 'Row'
      ? 'row'
      : node.type === 'Col'
        ? 'col'
        : node.direction === 'row'
          ? 'row'
          : 'col';
  return (
    <Box direction={direction} {...boxProps(node, ctx)}>
      {renderList(node.children, ctx, render)}
    </Box>
  );
}

export function renderText(node: TextNode, ctx: RenderCtx): ReactNode {
  return (
    <Text
      value={node.value}
      size={textSize(node.size)}
      weight={node.weight}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      textAlign={node.textAlign}
      italic={node.italic}
      lineThrough={node.lineThrough}
      truncate={node.truncate}
      maxLines={node.maxLines}
    />
  );
}

export function renderTitle(node: TitleNode, ctx: RenderCtx): ReactNode {
  const heroPx = resolveHeroTitlePx(node.size);
  return (
    <Title
      size={titleSize(node.size)}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      style={heroPx === undefined ? undefined : { fontSize: heroPx, lineHeight: heroPx * 1.05 }}
    >
      {node.value}
    </Title>
  );
}

export function renderCaption(node: CaptionNode, ctx: RenderCtx): ReactNode {
  return (
    <Caption
      value={node.value}
      size={captionSize(node.size)}
      weight={node.weight === 'bold' ? 'semibold' : node.weight}
      textAlign={node.textAlign}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      truncate={node.truncate}
      maxLines={node.maxLines}
    />
  );
}

export function renderLabel(node: LabelNode, ctx: RenderCtx): ReactNode {
  return (
    <Label
      value={node.value}
      fieldName={node.fieldName}
      size={node.size}
      weight={node.weight}
      textAlign={node.textAlign}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      dark={ctx.dark}
    />
  );
}

export function renderMarkdown(node: MarkdownNode, ctx: RenderCtx): ReactNode {
  return <Markdown value={node.value} streaming={node.streaming} dark={ctx.dark} />;
}

export function renderIcon(node: IconNode, ctx: RenderCtx): ReactNode {
  const name = resolveIconName(node.name);
  if (name === undefined) return null;
  const px = node.size === undefined ? 22 : (ICON_PX[node.size] ?? 22);
  return <Icon name={name} size={px} color={resolveOptionalColor(node.color, ctx.scheme)} dark={ctx.dark} />;
}

const BADGE_BG: Record<string, string> = {
  secondary: '#8a929d',
  success: '#1f9d55',
  danger: '#e3342f',
  warning: '#f6993f',
  info: '#3490dc',
  discovery: '#7e5bef',
};

export function renderBadge(node: BadgeNode): ReactNode {
  const tone = resolveBadgeColor(node.color);
  const bg = BADGE_BG[tone] ?? BADGE_BG.secondary;
  return (
    <Box
      direction="row"
      align="center"
      padding={{ x: 8, y: 2 }}
      radius={node.pill === true ? 'full' : 'sm'}
      background={bg}
    >
      <Text value={node.label} size="xs" weight="semibold" color="#ffffff" />
    </Box>
  );
}

export function renderImage(node: ImageNode): ReactNode {
  return (
    <Image
      src={node.src}
      alt={node.alt}
      fit={node.fit}
      radius={node.radius}
      frame={node.frame}
      flush={node.flush}
      size={node.size}
      width={node.width}
      height={node.height}
      minWidth={node.minWidth}
      maxWidth={node.maxWidth}
      minHeight={node.minHeight}
      maxHeight={node.maxHeight}
      aspectRatio={toNumber(node.aspectRatio)}
    />
  );
}

export function renderDivider(node: DividerNode, ctx: RenderCtx): ReactNode {
  return (
    <Divider
      spacing={toNumber(node.spacing)}
      size={toNumber(node.size)}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      flush={node.flush}
      dark={ctx.dark}
    />
  );
}

export function renderSpacer(node: SpacerNode): ReactNode {
  return <Spacer minSize={node.minSize} />;
}

function scalarPadding(value: SpacingValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function renderListView(
  node: ListViewNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  return (
    <ListView
      limit={typeof node.limit === 'number' ? node.limit : undefined}
      status={node.status}
      dark={ctx.dark}
    >
      {node.children.map((child, index) => (
        <ListViewItemRow key={nodeKey(child, index)} node={child} ctx={ctx} render={render} />
      ))}
    </ListView>
  );
}

function ListViewItemRow(props: {
  node: ListViewItemNode;
  ctx: RenderCtx;
  render: NodeRenderer;
}): ReactNode {
  const { node, ctx, render } = props;
  const row = (
    <ListViewItem
      gap={toNumber(node.gap)}
      align={resolveItemAlign(node.align)}
      dark={ctx.dark}
      onPress={
        node.onClickAction
          ? () => {
              dispatch(node.onClickAction, ctx);
            }
          : undefined
      }
    >
      {renderList(node.children, ctx, render)}
    </ListViewItem>
  );
  if (node.onLongPressAction === undefined && node.onSwipeAction === undefined) {
    return row;
  }
  const longPress = (): void => {
    dispatch(node.onLongPressAction, ctx);
  };
  const swipe = (direction: string): void => {
    dispatch(node.onSwipeAction, ctx, { direction });
  };
  return (
    <GesturePressable
      onLongPress={node.onLongPressAction ? longPress : undefined}
      onSwipe={node.onSwipeAction ? swipe : undefined}
    >
      {row}
    </GesturePressable>
  );
}

function resolveItemAlign(value: ListViewItemNode['align']): 'start' | 'center' | 'end' | undefined {
  if (value === 'start' || value === 'center' || value === 'end') return value;
  return undefined;
}

export function renderCard(
  node: CardNode,
  ctx: RenderCtx,
  children: ReactNode,
): ReactNode {
  return (
    <Card
      size={cardSize(node.size)}
      padding={scalarPadding(node.padding)}
      background={resolveOptionalColor(node.background, ctx.scheme)}
      status={node.status}
      collapsed={node.collapsed}
      dark={ctx.dark}
      confirm={cardAction(node.confirm, ctx)}
      cancel={cardAction(node.cancel, ctx)}
    >
      {children}
    </Card>
  );
}

function cardSize(value: CardNode['size']): 'sm' | 'md' | 'lg' | undefined {
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return undefined;
}

function cardAction(
  value: CardNode['confirm'],
  ctx: RenderCtx,
): { label: string; onPress: () => void } | undefined {
  if (value === undefined) return undefined;
  return {
    label: value.label,
    onPress: () => {
      dispatch(value.action, ctx);
    },
  };
}

export function renderChart(node: ChartNode, ctx: RenderCtx): ReactNode {
  return <KitChart node={node} ctx={ctx} />;
}

export function isLayout(node: WidgetNode): node is BoxNode | RowNode | ColNode {
  return node.type === 'Box' || node.type === 'Row' || node.type === 'Col';
}
