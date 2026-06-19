/** AppModal — the single reusable bottom-sheet modal for the app. Borderless
 *  sheet anchored to the bottom with rounded top corners, a dim tap-to-close
 *  backdrop, an optional title row with a close X, and a scrollable content
 *  area. Respects the bottom safe-area inset so content clears the Android
 *  global navigation bar (the reported overlap bug). */

import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
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
  const sheetBg = pal.bg; // sheet surface → bg token (editable)
  // Sheets are "blocks" → top corners follow the border-radius token. Bumped up
  // a touch (×1.4) so the sheet edge stays visibly rounder than inline cards,
  // preserving the bottom-sheet look at the 12px default. No hard cap so the
  // radius variable keeps applying when cranked up (channel-menu et al.).
  const sheetRadius = Math.round(useBlockRadius() * 1.4);

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
