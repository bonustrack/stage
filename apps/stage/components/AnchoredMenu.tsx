import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { AppModal } from './AppModal';
import { Box } from './layout';
import { anchoredMenuStyle, type MenuPoint } from './AnchoredMenu.model';
import { dismissContextMenuProps } from '../lib/contextMenu';
import { isCoarsePointer } from '../lib/pointer';
import { useBlockRadius, usePalette } from '../lib/theme';

const DESKTOP_MIN_WIDTH = 900;
const MENU_WIDTH = 300;

export const MENU_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

export function useAnchoredMenus(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH && !isCoarsePointer();
}

export function menuPointOf(event: GestureResponderEvent): MenuPoint {
  const { pageX, pageY } = event.nativeEvent;
  return { x: pageX, y: pageY };
}

export function AnchoredMenu({ visible, onClose, anchor, children }: {
  visible: boolean;
  onClose: () => void;
  anchor?: MenuPoint | null;
  children: ReactNode;
}): React.ReactElement {
  const anchored = useAnchoredMenus();
  const viewport = useWindowDimensions();
  const pal = usePalette();
  const radius = useBlockRadius();

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
          <Box
            width={MENU_WIDTH}
            background={pal.bg}
            radius={radius}
            style={{ overflow: 'hidden', ...MENU_SHADOW }}
          >
            <Scroll style={{ maxHeight }} showsVerticalScrollIndicator={false}>
              {children}
            </Scroll>
          </Box>
        </Pressable>
      </Pressable>
    </Dialog>
  );
}
