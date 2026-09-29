import type { ReactNode } from 'react';
import { Modal } from '@stage-labs/kit/react-native/modal';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useWebTabRail } from '../lib/webLayout';
import { useSafeAreaInsets } from '../lib/safeArea';

function useKeyboardLift(): number {
  const keyboard = useKeyboardState(state => (state.isVisible ? state.height : 0));
  const { bottom } = useSafeAreaInsets();
  return Math.max(0, keyboard - bottom);
}

export function AppModal({
  visible, onClose, title, children, footer, dismissable,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  dismissable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}): React.ReactElement {
  const lift = useKeyboardLift();
  return (
    <Modal open={visible} onClose={onClose} title={title} dismissable={dismissable} side={useWebTabRail() ? 'center' : 'bottom'}
      footer={footer} bottomInset={footer === undefined ? undefined : lift}>
      {children}
    </Modal>
  );
}
