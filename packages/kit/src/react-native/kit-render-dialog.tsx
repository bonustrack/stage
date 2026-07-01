
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DialogNode, Scheme, SpacingValue } from '../kit';
import { resolveColor, resolveOptionalColor, resolveRadius, resolveSpacing } from '../kit';
import {
  dispatch,
  renderList,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

function overlayStyle(node: DialogNode): ViewStyle {
  const stretch = node.side === 'bottom' || node.fullBleedPanel === true;
  return {
    flex: 1,
    justifyContent: node.fullBleedPanel
      ? 'flex-start'
      : node.side === 'bottom' ? 'flex-end' : 'center',
    alignItems: stretch ? 'stretch' : 'center',
  };
}

function panelRadiusStyle(node: DialogNode): ViewStyle {
  const radius = typeof node.panelRadius === 'number'
    ? node.panelRadius
    : resolveRadius(node.panelRadius);
  if (radius === undefined) return {};
  const style: ViewStyle = { borderTopLeftRadius: radius, borderTopRightRadius: radius };
  if (node.side !== 'bottom') {
    style.borderBottomLeftRadius = radius;
    style.borderBottomRightRadius = radius;
  }
  return style;
}

function panelBorderStyle(node: DialogNode, scheme: Scheme): ViewStyle {
  const border = resolveOptionalColor(node.panelBorderColor, scheme);
  return border === undefined ? {} : { borderTopWidth: 1, borderColor: border };
}

function panelStyle(node: DialogNode, scheme: Scheme, insetBottom: number): ViewStyle {
  const style: ViewStyle = {
    backgroundColor: resolveOptionalColor(node.panelBackground, scheme),
    maxHeight: node.panelMaxHeight as ViewStyle['maxHeight'],
    ...panelRadiusStyle(node),
    ...panelBorderStyle(node, scheme),
  };
  Object.assign(style, resolveSpacing(node.panelPadding, 'padding'));
  if (node.safeAreaBottom) {
    const base = typeof style.paddingBottom === 'number' ? style.paddingBottom : 0;
    style.paddingBottom = base + insetBottom;
  }
  return style;
}

function Handle(props: { color: string }): ReactNode {
  return (
    <View
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: props.color,
        alignSelf: 'center',
        marginBottom: 12,
      }}
    />
  );
}

function PanelBody(props: { node: DialogNode; content: ReactNode }): ReactNode {
  const { node, content } = props;
  if (node.scroll !== true) return content;
  return (
    <ScrollView
      keyboardShouldPersistTaps={node.keyboardPersistTaps === false ? 'never' : 'handled'}
      contentContainerStyle={spacingEntries(node.scrollPadding)}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );
}

function Panel(props: {
  node: DialogNode;
  scheme: Scheme;
  insetBottom: number;
  content: ReactNode;
}): ReactNode {
  const { node, scheme, insetBottom, content } = props;
  const handleColor = resolveOptionalColor(node.handleColor, scheme) ?? 'rgba(0,0,0,0.2)';
  return (
    <Pressable
      onPress={node.fullBleedPanel ? undefined : (e) => { e.stopPropagation(); }}
      pointerEvents={node.fullBleedPanel ? 'box-none' : undefined}
      style={node.fullBleedPanel ? { flex: 1 } : panelStyle(node, scheme, insetBottom)}
    >
      {node.handle ? <Handle color={handleColor} /> : null}
      <PanelBody node={node} content={content} />
    </Pressable>
  );
}

export interface DialogShellProps {
  node: DialogNode;
  scheme: Scheme;
  onClose: () => void;
  content: ReactNode;
}

export function DialogShell(props: DialogShellProps): ReactNode {
  const { node, scheme, onClose, content } = props;
  const insets = useSafeAreaInsets();
  const dismissable = node.dismissable !== false;
  const backdropColor = node.backdropColor !== undefined
    ? resolveColor(node.backdropColor, scheme)
    : 'rgba(0,0,0,0.5)';
  const close = (): void => {
    if (dismissable) onClose();
  };
  const inner = (
    <Panel node={node} scheme={scheme} insetBottom={insets.bottom} content={content} />
  );

  const overlay = (
    <Pressable
      onPress={node.backdrop === false ? undefined : close}
      style={[
        overlayStyle(node),
        node.backdrop === false ? null : { backgroundColor: backdropColor },
      ]}
    >
      {inner}
    </Pressable>
  );

  const body = node.gestureRoot
    ? <GestureHandlerRootView style={{ flex: 1 }}>{overlay}</GestureHandlerRootView>
    : overlay;

  return (
    <Modal
      visible={node.open}
      transparent
      animationType={node.animationType ?? 'fade'}
      onRequestClose={close}
    >
      {body}
    </Modal>
  );
}

function spacingEntries(value: SpacingValue | undefined): ViewStyle {
  return resolveSpacing(value, 'padding');
}

export function renderDialog(
  node: DialogNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  return (
    <DialogShell
      node={node}
      scheme={ctx.scheme}
      onClose={() => { dispatch(node.onCloseAction, ctx); }}
      content={renderList(node.children, ctx, render)}
    />
  );
}
