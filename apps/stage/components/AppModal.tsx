import type { ReactNode } from 'react';
import { Modal } from '@stage-labs/kit/react-native/modal';
import { useWebTabRail } from '../lib/webLayout';

export function AppModal({
  visible, onClose, title, children, dismissable,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  dismissable?: boolean;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Modal open={visible} onClose={onClose} title={title} dismissable={dismissable} side={useWebTabRail() ? 'center' : 'bottom'}>
      {children}
    </Modal>
  );
}
