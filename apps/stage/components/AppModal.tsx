import type { ReactNode } from 'react';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { useWebTabRail } from '../lib/webLayout';
import { CENTERED_MODAL_PAD, sheetPlacement } from './AppModal.model';

const SHEET_BOTTOM_PAD = 16;
const SHEET_RADIUS = Math.round(BLOCK_RADIUS_DEFAULT * 1.4);

export function AppModal({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}): React.ReactElement {
  const pal = usePalette();
  const place = sheetPlacement(useWebTabRail(), SHEET_BOTTOM_PAD);

  return (
    <Dialog
      open={visible}
      onClose={onClose}
      side={place.side}
      animationType="none"
      gestureRoot
      backdropColor="rgba(0,0,0,0.45)"
      panelBackground={pal.bg}
      panelRadius={SHEET_RADIUS}
      panelWidth={place.panelWidth}
      panelMaxWidth={place.panelMaxWidth}
      panelPadding={{ top: 18, bottom: place.bottomPad }}
      panelMaxHeight="88%"
      safeAreaBottom={place.safeAreaBottom}
      scroll
      keyboardPersistTaps
      scrollPadding={{ x: CENTERED_MODAL_PAD, top: 0 }}
    >
      {children}
    </Dialog>
  );
}
