import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col, Box } from '../layout';
import { usePalette } from '../../lib/theme';
import { ImportAccountPanel } from '../accounts/ImportAccountPanel';

type Pal = ReturnType<typeof usePalette>;

export function ImportStep({ pal, dark, busy, onTransfer, onBack }: {
  pal: Pal; dark: boolean; busy: boolean;
  onTransfer: (transfer: AccountTransfer) => void; onBack: () => void;
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 8 }}>
        <Title level={2} color={pal.text}>Import from another device</Title>
        <Text size="sm" color={pal.sub} style={{ marginTop: 8, marginBottom: 14 }}>
          On your other device open the account and choose Move to another device, then scan the code it shows.
        </Text>
        <ImportAccountPanel dark={dark} busy={busy} error={null} onSubmit={onTransfer} />
      </Box>
      <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
    </Col>
  );
}
