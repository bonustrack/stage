
import type { ReactNode } from 'react';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { usePalette, useBlockRadius } from '../lib/theme';

export function AppModal({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  const pal = usePalette();
  const sheetBg = pal.bg;
  const sheetRadius = Math.round(useBlockRadius() * 1.4);

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      side="bottom"
      animationType="slide"
      gestureRoot
      backdropColor="rgba(0,0,0,0.45)"
      panelBackground={sheetBg}
      panelRadius={sheetRadius}
      panelPadding={{ top: 18, bottom: 16 }}
      panelMaxHeight="88%"
      safeAreaBottom
      scroll
      keyboardPersistTaps
      scrollPadding={{ x: 16, top: 0 }}
    >
      {children}
    </Dialog>
  );
}
