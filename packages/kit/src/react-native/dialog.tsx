
import type { ReactNode } from 'react';
import type { Color, DialogNode, RadiusValue, Dimension, SpacingValue } from '../kit';
import { useKitScheme } from './theme-context';
import { DialogShell } from './kit-render-dialog';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  backdrop?: boolean;
  backdropColor?: Color;
  side?: 'center' | 'bottom';
  dismissable?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  gestureRoot?: boolean;
  safeAreaBottom?: boolean;
  panelBackground?: Color;
  panelRadius?: RadiusValue | number;
  panelMaxHeight?: Dimension;
  panelPadding?: SpacingValue;
  panelBorderColor?: Color;
  handle?: boolean;
  handleColor?: Color;
  scroll?: boolean;
  keyboardPersistTaps?: boolean;
  scrollPadding?: SpacingValue;
  fullBleedPanel?: boolean;
}

export function Dialog(props: DialogProps): ReactNode {
  const scheme = useKitScheme();
  const { open, onClose, children, ...rest } = props;
  const node: DialogNode = { type: 'Dialog', open, children: [], ...rest };
  return (
    <DialogShell node={node} scheme={scheme} onClose={onClose} content={children} />
  );
}
