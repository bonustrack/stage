
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveBoxRadius, resolveOptionalColor, type Color, type RadiusValue, type Scheme } from '../tokens';
import { spacingEntries, type SpacingValue } from '../layout';
import { useKitScheme } from './theme-context';

export type DialogSide = 'center' | 'bottom' | 'end';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  bottomInset?: number;
  backdrop?: boolean;
  backdropColor?: Color;
  side?: DialogSide;
  dismissable?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  gestureRoot?: boolean;
  safeAreaBottom?: boolean;
  panelBackground?: Color;
  panelRadius?: RadiusValue | number;
  panelMaxHeight?: number | string;
  panelWidth?: number | string;
  panelMaxWidth?: number | string;
  panelPadding?: SpacingValue;
  panelBorderColor?: Color;
  panelBorderSides?: 'top' | 'start' | 'all';
  handle?: boolean;
  handleColor?: Color;
  scroll?: boolean;
  keyboardPersistTaps?: boolean;
  avoidKeyboard?: boolean;
  scrollPadding?: SpacingValue;
  fullBleedPanel?: boolean;
}

const NO_FOCUS_RING: ViewStyle = { outlineWidth: 0, outlineStyle: 'solid' };

const SIDE_OVERLAY: ViewStyle = { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'stretch' };

function overlayStyle(props: DialogProps): ViewStyle {
  if (props.side === 'end' && props.fullBleedPanel !== true) return SIDE_OVERLAY;
  const stretch = props.side === 'bottom' || props.fullBleedPanel === true;
  return {
    flex: 1,
    justifyContent: props.fullBleedPanel
      ? 'flex-start'
      : props.side === 'bottom' ? 'flex-end' : 'center',
    alignItems: stretch ? 'stretch' : 'center',
    paddingBottom: props.bottomInset,
  };
}

function panelRadiusStyle(props: DialogProps): ViewStyle {
  if (props.panelRadius === undefined) return {};
  const radius = resolveBoxRadius(props.panelRadius);
  if (props.side === 'end') return { borderTopLeftRadius: radius, borderBottomLeftRadius: radius };
  const style: ViewStyle = { borderTopLeftRadius: radius, borderTopRightRadius: radius };
  if (props.side !== 'bottom') {
    style.borderBottomLeftRadius = radius;
    style.borderBottomRightRadius = radius;
  }
  return style;
}

function panelBorderStyle(props: DialogProps, scheme: Scheme): ViewStyle {
  const border = resolveOptionalColor(props.panelBorderColor, scheme);
  if (border === undefined) return {};
  if (props.panelBorderSides === 'all') return { borderWidth: 1, borderColor: border };
  return props.panelBorderSides === 'start' ? { borderLeftWidth: 1, borderColor: border } : { borderTopWidth: 1, borderColor: border };
}

function panelStyle(props: DialogProps, scheme: Scheme, insetBottom: number): ViewStyle {
  const style: ViewStyle = {
    backgroundColor: resolveOptionalColor(props.panelBackground, scheme),
    maxHeight: props.panelMaxHeight as ViewStyle['maxHeight'],
    width: props.panelWidth as ViewStyle['width'],
    maxWidth: props.panelMaxWidth as ViewStyle['maxWidth'],
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
  return <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: props.color, alignSelf: 'center', marginBottom: 12 }} />;
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
      style={[props.fullBleedPanel ? { flex: 1 } : panelStyle(props, scheme, insetBottom), NO_FOCUS_RING]}
    >
      {props.handle ? <Handle color={handleColor} /> : null}
      {props.header}
      <PanelBody props={props} content={content} />
      {props.footer}
    </Pressable>
  );
}

export function Dialog(props: DialogProps): ReactNode {
  const scheme = useKitScheme();
  const insets = useSafeAreaInsets();
  const { open, onClose, children } = props;
  const backdrop = props.backdrop !== false;
  const close = (): void => {
    if (props.dismissable !== false) onClose();
  };
  const overlay = (
    <KeyboardAvoidingView
      enabled={props.avoidKeyboard === true && Platform.OS === 'ios'} behavior="padding"
      pointerEvents="box-none"
      style={[overlayStyle(props), backdrop ? { backgroundColor: resolveOptionalColor(props.backdropColor, scheme) ?? 'rgba(0,0,0,0.5)' } : null]}
    >
      {backdrop ? <Pressable accessible={false} focusable={false} onPress={close} style={[StyleSheet.absoluteFill, NO_FOCUS_RING]} /> : null}
      <Panel props={props} scheme={scheme} insetBottom={insets.bottom} content={children} />
    </KeyboardAvoidingView>
  );
  return (
    <Modal visible={open} transparent animationType={props.animationType ?? 'fade'} onRequestClose={close}>
      {props.gestureRoot ? <GestureHandlerRootView style={{ flex: 1 }}>{overlay}</GestureHandlerRootView> : overlay}
    </Modal>
  );
}
