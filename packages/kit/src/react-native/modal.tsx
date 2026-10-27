import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { BLOCK_RADIUS_DEFAULT, type Color, type KitPalette } from '../tokens';
import { SIZES } from '../button.styles';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { Button } from './button';
import { Dialog } from './dialog';
import { Glyph } from './glyph';
import { Text } from './text';
import { Tooltip } from './tooltip';
import { useKitPaletteFor, useKitScheme } from './theme-context';

export const MODAL = {
  maxWidth: 480,
  padding: 16,
  sheetBottomPadding: 16,
  topPadding: 18,
  titleGap: 12,
  radius: Math.round(BLOCK_RADIUS_DEFAULT * 1.4),
  backdrop: 'rgba(0,0,0,0.45)',
  maxHeight: '88%',
} as const;

const ModalCloseContext = createContext<(() => void) | null>(null);

export function useModalClose(): (() => void) | null {
  return useContext(ModalCloseContext);
}

export interface ModalProps extends A2uiCommonProps {
  trigger?: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  title?: string;
  footer?: ReactNode;
  bottomInset?: number;
  side?: 'center' | 'bottom';
  dark?: boolean;
  background?: string;
  borderColor?: string;
  dismissable?: boolean;
  fullBleedPanel?: boolean;
  backdrop?: boolean;
  backdropColor?: Color;
  animationType?: 'slide' | 'fade' | 'none';
  gestureRoot?: boolean;
}

function ModalHeader({ title, onClose, pal, dark, dismissable }: {
  title: string | undefined; onClose: () => void; pal: KitPalette; dark: boolean; dismissable: boolean;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const insets = useSafeAreaInsets();
  const tooltipHalfWidth = MODAL.padding + SIZES.md.height / 2 - 8;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: MODAL.titleGap, marginLeft: MODAL.padding + insets.left, marginRight: MODAL.padding + insets.right, marginBottom: MODAL.titleGap, flexShrink: 0, zIndex: 1 }}>
      <View style={{ flex: 1, minWidth: 0, minHeight: SIZES.md.height, justifyContent: 'center' }}>
        {title === undefined ? null : <Text accessibilityRole="header" text={title} size="2xl" fontWeight="semibold" color={pal.link} />}
      </View>
      {dismissable ? (
        <View>
          <Button
            accessibilityRole="button" accessibilityLabel="Close modal"
            color="secondary" variant="ghost" uniform pill dark={dark} hitSlop={4}
            onPress={onClose} onHoverIn={() => { setHovered(true); }} onHoverOut={() => { setHovered(false); }}
          >
            <Glyph icon={IconCrossMedium} size={22} color={hovered ? pal.link : pal.text} />
          </Button>
          {hovered ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: '100%', right: 0, width: SIZES.md.height, alignItems: 'center', paddingTop: 4 }}>
              <Tooltip label="Close" arrow="up" dark={dark} onBubbleWidth={setTooltipWidth} bubbleOffset={-Math.max(0, tooltipWidth / 2 - tooltipHalfWidth)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface PanelProps {
  props: ModalProps;
  open: boolean;
  close: () => void;
}

function StagePanel({ props, open, close }: PanelProps): React.ReactElement {
  const { children, title, footer, bottomInset, side = 'center', dark, background, borderColor, dismissable = true } = props;
  const pal = useKitPaletteFor(dark);
  const scheme = useKitScheme();
  const centered = side === 'center';
  return (
    <Dialog
      open={open}
      onClose={close}
      side={side}
      dismissable={dismissable}
      header={<ModalHeader title={title} onClose={close} pal={pal} dark={dark ?? scheme === 'dark'} dismissable={dismissable} />}
      footer={footer}
      bottomInset={bottomInset}
      animationType="none"
      gestureRoot
      backdropColor={MODAL.backdrop}
      panelBackground={background ?? pal.bg}
      panelBorderColor={borderColor}
      panelBorderSides={centered ? 'all' : 'top'}
      panelRadius={MODAL.radius}
      panelWidth={centered ? '100%' : undefined}
      panelMaxWidth={centered ? MODAL.maxWidth : undefined}
      panelPadding={{ top: MODAL.topPadding, bottom: centered ? MODAL.padding : MODAL.sheetBottomPadding }}
      panelMaxHeight={MODAL.maxHeight}
      safeAreaBottom={!centered}
      scroll
      keyboardPersistTaps
      scrollPadding={{ x: MODAL.padding, top: 0 }}
    >
      {children}
    </Dialog>
  );
}

function FullBleedPanel({ props, open, close }: PanelProps): React.ReactElement {
  return (
    <Dialog
      open={open}
      onClose={close}
      animationType={props.animationType}
      backdrop={props.backdrop}
      backdropColor={props.backdropColor}
      dismissable={props.dismissable}
      gestureRoot={props.gestureRoot}
      fullBleedPanel
    >
      {props.children}
    </Dialog>
  );
}

export function Modal(props: ModalProps): React.ReactElement {
  const { trigger, open: controlled, defaultOpen = false, onClose, onOpen, fullBleedPanel, weight, accessibility } = props;
  const [internal, setInternal] = useState(defaultOpen);
  const open = controlled ?? internal;
  const close = (): void => {
    if (controlled === undefined) setInternal(false);
    onClose?.();
  };
  const content = { ...props, children: <ModalCloseContext.Provider value={close}>{props.children}</ModalCloseContext.Provider> };
  const panel = fullBleedPanel === true
    ? <FullBleedPanel props={content} open={open} close={close} />
    : <StagePanel props={content} open={open} close={close} />;
  if (trigger === undefined) return panel;
  return (
    <View {...accessibilityProps(accessibility)} style={weightStyle(weight)}>
      <Pressable accessibilityRole="none" onPress={() => { if (controlled === undefined) setInternal(true); onOpen?.(); }}>
        <View pointerEvents="none">{trigger}</View>
      </Pressable>
      {panel}
    </View>
  );
}
