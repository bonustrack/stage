import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { AppModal } from './AppModal';
import { Box } from './layout';
import { documentScroll } from '../lib/documentScroll';
import { anchoredMenuStyle, type MenuPoint } from './AnchoredMenu.model';
import { dismissContextMenuProps } from '../lib/contextMenu';
import { isCoarsePointer } from '../lib/pointer';
import { useBlockRadius, usePalette } from '../lib/theme';

const DESKTOP_MIN_WIDTH = 900;
export const MENU_WIDTH = 260;

export const MENU_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

export function MenuSurface({ width = MENU_WIDTH, maxHeight, children }: {
  width?: number; maxHeight?: number; children: ReactNode;
}): React.ReactElement {
  const pal = usePalette();
  const radius = useBlockRadius();
  const edge = { width: 1, color: pal.border };
  return (
    <Box
      width={width}
      background={pal.inputBg}
      radius={radius}
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      style={{ overflow: 'hidden', ...MENU_SHADOW }}
    >
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
  return rect === undefined ? menuPointOf(event) : { x: rect.left, y: rect.bottom + 6 };
}

export function menuPointBeside(event: GestureResponderEvent): MenuPoint {
  const rect = anchorRect(event);
  return rect === undefined ? menuPointOf(event) : { x: rect.right + 6, y: rect.top };
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
    <Dialog
      open={visible}
      onClose={onClose}
      animationType="none"
      backdropColor="transparent"
      fullBleedPanel
    >
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFillObject}
        {...dismissContextMenuProps(onClose)}
      >
        <Pressable
          onPress={(e) => { e.stopPropagation(); }}
          style={{ position: 'absolute', ...position }}
        >
          <MenuSurface maxHeight={maxHeight}>{children}</MenuSurface>
        </Pressable>
      </Pressable>
    </Dialog>
  );
}
