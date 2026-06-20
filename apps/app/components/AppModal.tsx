
import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useBlockRadius } from '../lib/theme';

export function AppModal({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const sheetBg = pal.bg;
  const sheetRadius = Math.round(useBlockRadius() * 1.4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={e => { e.stopPropagation(); }}
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
            paddingTop: 18,
            paddingBottom: insets.bottom + 16,
            maxHeight: '88%',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0 }}
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
