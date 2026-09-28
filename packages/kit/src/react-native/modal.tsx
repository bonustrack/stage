import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { BLOCK_RADIUS_DEFAULT, kitPalette, type KitPalette } from '../tokens';
import { SIZES } from '../button.styles';
import { Button } from './button';
import { Dialog } from './dialog';
import { Glyph } from './glyph';
import { Text } from './text';
import { Tooltip } from './tooltip';
import { useKitPalette, useKitScheme } from './theme-context';

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

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  side?: 'center' | 'bottom';
  dark?: boolean;
  background?: string;
  borderColor?: string;
  dismissable?: boolean;
}

function usePalette(dark: boolean | undefined): KitPalette {
  const context = useKitPalette();
  if (dark === undefined) return context;
  return kitPalette(dark ? 'dark' : 'light');
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
        {title === undefined ? null : <Text accessibilityRole="header" value={title} size="5xl" weight="semibold" color={pal.link} />}
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

export function Modal({ open, onClose, children, title, side = 'center', dark, background, borderColor, dismissable = true }: ModalProps): React.ReactElement {
  const pal = usePalette(dark);
  const scheme = useKitScheme();
  const centered = side === 'center';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      side={side}
      dismissable={dismissable}
      header={<ModalHeader title={title} onClose={onClose} pal={pal} dark={dark ?? scheme === 'dark'} dismissable={dismissable} />}
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
