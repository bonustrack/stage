
import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import type { ScrollRowNode, StackNode, WidgetNode } from '../kit';
import { resolvePosition } from '../kit';
import { Box } from './box';
import {
  nodeKey,
  renderList,
  toNumber,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

function stackChildStyle(node: WidgetNode): ViewStyle {
  const pos = resolvePosition(node);
  const style: ViewStyle = { position: pos.position };
  if (pos.top !== undefined) style.top = pos.top as ViewStyle['top'];
  if (pos.right !== undefined) style.right = pos.right as ViewStyle['right'];
  if (pos.bottom !== undefined) style.bottom = pos.bottom as ViewStyle['bottom'];
  if (pos.left !== undefined) style.left = pos.left as ViewStyle['left'];
  if (pos.zIndex !== undefined) style.zIndex = pos.zIndex;
  return style;
}

function alignToFlex(value: StackNode['align']): ViewStyle['alignItems'] {
  switch (value) {
    case 'start':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    case 'baseline':
      return 'baseline';
    default:
      return undefined;
  }
}

function justifyToFlex(value: StackNode['justify']): ViewStyle['justifyContent'] {
  switch (value) {
    case 'start':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'between':
      return 'space-between';
    case 'around':
      return 'space-around';
    case 'evenly':
      return 'space-evenly';
    default:
      return undefined;
  }
}

export function renderStack(
  node: StackNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const containerStyle: ViewStyle = {
    position: 'relative',
    width: node.width as ViewStyle['width'],
    height: node.height as ViewStyle['height'],
    alignItems: alignToFlex(node.align),
    justifyContent: justifyToFlex(node.justify),
  };
  if (node.size !== undefined) {
    containerStyle.width = node.size as ViewStyle['width'];
    containerStyle.height = node.size as ViewStyle['height'];
  }
  return (
    <View style={containerStyle}>
      {node.children.map((child, index) => (
        <View key={nodeKey(child, index)} style={stackChildStyle(child)}>
          {render(child, ctx)}
        </View>
      ))}
    </View>
  );
}

export function renderScrollRow(
  node: ScrollRowNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const gap = toNumber(node.gap);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Box direction="row" gap={gap} padding={node.padding}>
        {renderList(node.children, ctx, render)}
      </Box>
    </ScrollView>
  );
}
