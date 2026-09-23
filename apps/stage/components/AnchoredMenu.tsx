import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { AppModal } from './AppModal';
import { Box } from './layout';
import { anchoredMenuStyle, type MenuPoint } from './AnchoredMenu.model';
import { dismissContextMenuProps } from '../lib/contextMenu';
import { documentScroll, isCoarsePointer } from '../lib/webLayout';
import { usePalette } from '../lib/theme';
import { MENU_GAP, MENU_RADIUS, MENU_SHADOW } from './menuStyle';

const DESKTOP_MIN_WIDTH = 900;
export const MENU_WIDTH = 260;

export { MENU_SHADOW };

export function MenuSurface({ maxHeight, children }: {
  maxHeight?: number; children: ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Box background={border} radius={MENU_RADIUS} style={{ overflow: 'hidden', ...MENU_SHADOW }}>
      {maxHeight === undefined ? children : (
        <Scroll style={{ maxHeight }} showsVerticalScrollIndicator={false}>{children}</Scroll>
      )}
    </Box>
  );
}

export function useAnchoredMenus(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH && !isCoarsePointer();
}

export function menuPointOf(event: GestureResponderEvent): MenuPoint {
  const { pageX, pageY } = event.nativeEvent;
  const scroll = documentScroll();
  return { x: pageX - scroll.x, y: pageY - scroll.y };
}

interface AnchorRect { left: number; right: number; top: number; bottom: number }

function anchorRect(event: GestureResponderEvent): AnchorRect | undefined {
  const target = event.currentTarget as unknown as { getBoundingClientRect?: () => AnchorRect };
  return target.getBoundingClientRect?.();
}

export function menuPointBelow(event: GestureResponderEvent): MenuPoint {
  const rect = anchorRect(event);
  return rect === undefined ? menuPointOf(event) : { x: rect.left, y: rect.bottom + MENU_GAP };
}

export function AnchoredOverlay({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Dialog open={open} onClose={onClose} animationType="none" backdropColor="transparent" fullBleedPanel>
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFillObject}
        {...dismissContextMenuProps(onClose)}
      >
        {children}
      </Pressable>
    </Dialog>
  );
}

export function AnchoredMenu({ visible, onClose, anchor, children }: {
  visible: boolean;
  onClose: () => void;
  anchor?: MenuPoint | null;
  children: ReactNode;
}): React.ReactElement {
  const anchored = useAnchoredMenus();
  const viewport = useWindowDimensions();

  if (!anchored || !anchor) {
    return (
      <AppModal visible={visible} onClose={onClose}>
        <Box margin={{ x: -16 }}>{children}</Box>
      </AppModal>
    );
  }

  const { maxHeight, ...position } = anchoredMenuStyle(anchor, viewport);
  return (
    <AnchoredOverlay open={visible} onClose={onClose}>
      <Pressable
        onPress={(e) => { e.stopPropagation(); }}
        style={{ position: 'absolute', ...position }}
      >
        <MenuSurface maxHeight={maxHeight}>{children}</MenuSurface>
      </Pressable>
    </AnchoredOverlay>
  );
}
