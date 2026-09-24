import type { ReactNode } from 'react';
import { BLOCK_RADIUS_DEFAULT, kitPalette, type KitPalette } from '../tokens';
import { Dialog } from './dialog';
import { Text } from './text';
import { useKitPalette } from './theme-context';

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
}

function usePalette(dark: boolean | undefined): KitPalette {
  const context = useKitPalette();
  if (dark === undefined) return context;
  return kitPalette(dark ? 'dark' : 'light');
}

export function Modal({ open, onClose, children, title, side = 'center', dark, background, borderColor }: ModalProps): React.ReactElement {
  const pal = usePalette(dark);
  const centered = side === 'center';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      side={side}
      animationType="none"
      gestureRoot
      backdropColor={MODAL.backdrop}
      panelBackground={background ?? pal.bg}
      panelBorderColor={borderColor ?? pal.border}
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
      {title === undefined ? null : (
        <Text value={title} size="3xl" weight="semibold" style={{ marginBottom: MODAL.titleGap }} />
      )}
      {children}
    </Dialog>
  );
}
