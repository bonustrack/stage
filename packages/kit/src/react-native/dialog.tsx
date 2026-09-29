
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
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
  header?: ReactNode;
  footer?: ReactNode;
  bottomInset?: number;
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
  panelWidth?: number | string;
  panelMaxWidth?: number | string;
  panelPadding?: SpacingValue;
  panelBorderColor?: Color;
  panelBorderSides?: 'top' | 'all';
  handle?: boolean;
  handleColor?: Color;
  scroll?: boolean;
  keyboardPersistTaps?: boolean;
  scrollPadding?: SpacingValue;
  fullBleedPanel?: boolean;
}

const NO_FOCUS_RING: ViewStyle = { outlineWidth: 0, outlineStyle: 'solid' };

function overlayStyle(props: DialogProps): ViewStyle {
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
  if (border === undefined) return {};
  return props.panelBorderSides === 'all' ? { borderWidth: 1, borderColor: border } : { borderTopWidth: 1, borderColor: border };
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
    <View
      pointerEvents="box-none"
      style={[
        overlayStyle(props),
        props.backdrop === false ? null : { backgroundColor: backdropColor },
      ]}
    >
      {props.backdrop === false ? null : (
        <Pressable accessible={false} focusable={false} onPress={close} style={[StyleSheet.absoluteFill, NO_FOCUS_RING]} />
      )}
      {inner}
    </View>
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
