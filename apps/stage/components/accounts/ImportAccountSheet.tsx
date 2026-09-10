import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { ImportAccountPanel } from './ImportAccountPanel';

export function ImportAccountSheet({ visible, dark, busy, error, onClose, onSubmit }: {
  visible: boolean; dark: boolean; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (transfer: AccountTransfer) => void;
}): React.ReactElement {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Col gap={12}>
        <Title level={3}>Import account</Title>
        <Text size="sm" role="secondary">
          Bring an account over from another device. On that device, open the account and choose Move to another device to show the code.
        </Text>
        <ImportAccountPanel dark={dark} busy={busy} error={error} onSubmit={onSubmit} />
      </Col>
    </AppModal>
  );
}
