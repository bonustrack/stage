
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveColor, resolveOptionalColor, type Color, type Scheme } from '../tokens';
import { resolveBoxRadius, type RadiusValue } from '../radius';
import { spacingEntries, type SpacingValue } from '../layout';
import { useKitScheme } from './theme-context';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  backdrop?: boolean;
  backdropColor?: Color;
  side?: 'center' | 'bottom';
  dismissable?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  gestureRoot?: boolean;
  safeAreaBottom?: boolean;
  panelBackground?: Color;
  panelRadius?: RadiusValue | number;
  panelMaxHeight?: number | string;
  panelPadding?: SpacingValue;
  panelBorderColor?: Color;
  handle?: boolean;
  handleColor?: Color;
  scroll?: boolean;
  keyboardPersistTaps?: boolean;
  scrollPadding?: SpacingValue;
  fullBleedPanel?: boolean;
}

function overlayStyle(props: DialogProps): ViewStyle {
  const stretch = props.side === 'bottom' || props.fullBleedPanel === true;
  return {
    flex: 1,
    justifyContent: props.fullBleedPanel
      ? 'flex-start'
      : props.side === 'bottom' ? 'flex-end' : 'center',
    alignItems: stretch ? 'stretch' : 'center',
  };
}

function panelRadiusStyle(props: DialogProps): ViewStyle {
  const radius = props.panelRadius === undefined
    ? undefined
    : resolveBoxRadius(props.panelRadius);
  if (radius === undefined) return {};
  const style: ViewStyle = { borderTopLeftRadius: radius, borderTopRightRadius: radius };
  if (props.side !== 'bottom') {
    style.borderBottomLeftRadius = radius;
    style.borderBottomRightRadius = radius;
  }
  return style;
}

function panelBorderStyle(props: DialogProps, scheme: Scheme): ViewStyle {
  const border = resolveOptionalColor(props.panelBorderColor, scheme);
  return border === undefined ? {} : { borderTopWidth: 1, borderColor: border };
}

function panelStyle(props: DialogProps, scheme: Scheme, insetBottom: number): ViewStyle {
  const style: ViewStyle = {
    backgroundColor: resolveOptionalColor(props.panelBackground, scheme),
    maxHeight: props.panelMaxHeight as ViewStyle['maxHeight'],
    ...panelRadiusStyle(props),
    ...panelBorderStyle(props, scheme),
  };
  Object.assign(style, spacingEntries('padding', props.panelPadding));
  if (props.safeAreaBottom) {
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

function PanelBody(bodyProps: { props: DialogProps; content: ReactNode }): ReactNode {
  const { props, content } = bodyProps;
  if (props.scroll !== true) return content;
  return (
    <ScrollView
      keyboardShouldPersistTaps={props.keyboardPersistTaps === false ? 'never' : 'handled'}
      contentContainerStyle={spacingEntries('padding', props.scrollPadding)}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );
}

function Panel(panelProps: {
  props: DialogProps;
  scheme: Scheme;
  insetBottom: number;
  content: ReactNode;
}): ReactNode {
  const { props, scheme, insetBottom, content } = panelProps;
  const handleColor = resolveOptionalColor(props.handleColor, scheme) ?? 'rgba(0,0,0,0.2)';
  return (
    <Pressable
      onPress={props.fullBleedPanel ? undefined : (e) => { e.stopPropagation(); }}
      pointerEvents={props.fullBleedPanel ? 'box-none' : undefined}
      style={props.fullBleedPanel ? { flex: 1 } : panelStyle(props, scheme, insetBottom)}
    >
      {props.handle ? <Handle color={handleColor} /> : null}
      <PanelBody props={props} content={content} />
    </Pressable>
  );
}

export function Dialog(props: DialogProps): ReactNode {
  const scheme = useKitScheme();
  const insets = useSafeAreaInsets();
  const { open, onClose, children } = props;
  const dismissable = props.dismissable !== false;
  const backdropColor = props.backdropColor !== undefined
    ? resolveColor(props.backdropColor, scheme)
    : 'rgba(0,0,0,0.5)';
  const close = (): void => {
    if (dismissable) onClose();
  };
  const inner = (
    <Panel props={props} scheme={scheme} insetBottom={insets.bottom} content={children} />
  );

  const overlay = (
    <Pressable
      onPress={props.backdrop === false ? undefined : close}
      style={[
        overlayStyle(props),
        props.backdrop === false ? null : { backgroundColor: backdropColor },
      ]}
    >
      {inner}
    </Pressable>
  );

  const body = props.gestureRoot
    ? <GestureHandlerRootView style={{ flex: 1 }}>{overlay}</GestureHandlerRootView>
    : overlay;

  return (
    <Modal
      visible={open}
      transparent
      animationType={props.animationType ?? 'fade'}
      onRequestClose={close}
    >
      {body}
    </Modal>
  );
}
