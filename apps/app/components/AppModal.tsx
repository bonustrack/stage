/** @file AppModal: the app's reusable bottom-sheet modal with rounded top corners, tap-to-close backdrop, scrollable content, and safe-area handling. */

import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useBlockRadius } from '../lib/theme';

/** Renders the app's reusable bottom-sheet modal with a backdrop, optional title row, and scrollable content. */
export function AppModal({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Accepted for call-site compatibility; no longer rendered (no title chrome). */
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const sheetBg = pal.bg; /** sheet surface → bg token (editable) */
  /** Sheet top corners follow the border-radius token, bumped ×1.4 so the edge stays rounder than inline cards; no hard cap so the radius keeps applying when cranked up. */
  const sheetRadius = Math.round(useBlockRadius() * 1.4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/** RN Modal renders in its own native window the app-root GestureHandlerRootView doesn't cover; without this wrapper every inner GestureDetector is silently dead. */}
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
