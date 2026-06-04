/** AppModal — the single reusable bottom-sheet modal for the app. Borderless
 *  sheet anchored to the bottom with rounded top corners, a dim tap-to-close
 *  backdrop, an optional title row with a close X, and a scrollable content
 *  area. Respects the bottom safe-area inset so content clears the Android
 *  global navigation bar (the reported overlap bug). */

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Title } from '@metro-labs/kit/title';
import { Box } from './layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { Icon } from '@metro-labs/kit/icon';

export function AppModal({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const sheetBg = pal.bg; // sheet surface → bg token (editable)
  const head = pal.primary; // #ffffff / #000000

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* RN <Modal> renders in its OWN native window the app-root
          GestureHandlerRootView does NOT cover — without this wrapper every
          GestureDetector inside (the ColorPicker sliders) is silently dead. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: title ? 14 : 18,
            paddingBottom: insets.bottom + 16,
            maxHeight: '88%',
          }}
        >
          {title ? (
            <Box style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingBottom: 4,
            }}>
              <Title dark={dark} style={{ color: head, fontSize: 20 }}>
                {title}
              </Title>
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="x" size={22} color={head} />
              </Pressable>
            </Box>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: title ? 8 : 0 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
