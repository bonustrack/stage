import type { ReactNode } from 'react';
import { Modal } from '@stage-labs/kit/react-native/modal';
import { useWebTabRail } from '../lib/webLayout';

export function AppModal({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Modal open={visible} onClose={onClose} title={title} side={useWebTabRail() ? 'center' : 'bottom'}>
      {children}
    </Modal>
  );
}
