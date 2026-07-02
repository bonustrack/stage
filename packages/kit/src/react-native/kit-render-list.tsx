import type { ReactNode } from 'react';
import type { ListViewItemNode, ListViewNode } from '../kit';
import { resolveListItemStyle } from '../kit';
import { GesturePressable } from './gesture-pressable';
import { ListView, ListViewItem } from './list-view';
import {
  dispatch,
  nodeKey,
  renderList,
  toNumber,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

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

export function renderListViewItem(
  node: ListViewItemNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  return <ListViewItemRow node={node} ctx={ctx} render={render} />;
}

function ListViewItemRow(props: {
  node: ListViewItemNode;
  ctx: RenderCtx;
  render: NodeRenderer;
}): ReactNode {
  const { node, ctx, render } = props;
  const itemStyle = resolveListItemStyle(node, ctx.scheme);
  const row = (
    <ListViewItem
      gap={toNumber(node.gap)}
      align={resolveItemAlign(node.align)}
      dark={ctx.dark}
      padding={itemStyle.padding}
      border={itemStyle.border}
      pressedBackground={itemStyle.pressedBackground}
      pressedBorderColor={itemStyle.pressedBorderColor}
      showDivider={itemStyle.showDivider}
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
