
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { DialogNode } from '../kit';
import {
  dispatch,
  renderList,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

const BACKDROP_STYLE: ViewStyle = {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.5)',
};

function overlayStyle(side: DialogNode['side']): ViewStyle {
  return {
    flex: 1,
    justifyContent: side === 'bottom' ? 'flex-end' : 'center',
    alignItems: 'center',
  };
}

export function renderDialog(
  node: DialogNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const dismissable = node.dismissable !== false;
  const close = (): void => {
    if (dismissable) dispatch(node.onCloseAction, ctx);
  };
  return (
    <Modal
      visible={node.open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={overlayStyle(node.side)}>
        {node.backdrop === false ? null : (
          <Pressable
            style={BACKDROP_STYLE}
            onPress={dismissable ? close : undefined}
          />
        )}
        <View>{renderList(node.children, ctx, render)}</View>
      </View>
    </Modal>
  );
}
