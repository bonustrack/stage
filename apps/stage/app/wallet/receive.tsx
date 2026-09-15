
import { useQuery } from '@tanstack/react-query';

import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { capabilities } from '../../lib/capabilities';
import { Box, Col, ScreenScroll } from '../../components/layout';
import { WalletHeader } from '../../components/wallet/WalletHeader';
import { AppIcon } from '../../components/widgets';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';

const ADDRESS_LABEL = 'Wallet address (tap to copy)';
const ADDRESS_HINT = 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.';

const QR_FIXED_FOREGROUND = '#000000';
const QR_FIXED_BACKGROUND = '#ffffff';
const QR_PLACEHOLDER_BACKGROUND = '#f4f4f5';

function AddressCard({ label, address, hint, onCopy }: {
  label: string; address: string; hint: string;
  onCopy: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <Col gap={8}>
      <Caption value={label.toUpperCase()} color="secondary" size="sm" />
      <ListViewItem align="center" gap={12} dark={dark} onPress={onCopy}>
        <Col flex={1}>
          <Text value={address || '—'} size="md" truncate />
        </Col>
        <AppIcon name="copy" color="secondary" size={16} />
      </ListViewItem>
      <Caption value={hint} color="secondary" textAlign="center" />
    </Col>
  );
}

function QrPanel({ address, border }: {
  address: string; border: string;
}): React.ReactElement {
  const side = { width: 1, color: border };
  return (
    <Box
      background={QR_FIXED_BACKGROUND}
      radius="xl"
      padding={16}
      align="center"
      justify="center"
      border={{ top: side, right: side, bottom: side, left: side }}
    >
      {address ? (
        <QrCode
          value={address}
          size={240}
          color={QR_FIXED_FOREGROUND}
          background={QR_FIXED_BACKGROUND}
        />
      ) : (
        <Box width={240} height={240} background={QR_PLACEHOLDER_BACKGROUND} />
      )}
    </Box>
  );
}

export default function WalletReceive(): React.ReactElement {
  const { border } = usePalette();

  const { data: address = '' } = useQuery({
    queryKey: ['receivePublicAddress'],
    queryFn: async (): Promise<string> =>
      (await getOrCreateXmtpClient('production')).publicIdentity.identifier,
  });

  const onCopy = (): void => {
    if (!address) return;
    void capabilities.copyToClipboard(address);
    capabilities.toast('Address copied');
  };

  return (
    <Col surface="surface" flex={1}>
      <WalletHeader title="Receive" />

      <ScreenScroll contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <Col width="100%">
          <Col align="center" gap={16}>
            <QrPanel address={address} border={border} />
            <AddressCard label={ADDRESS_LABEL} address={address || '—'} hint={ADDRESS_HINT} onCopy={onCopy} />
          </Col>
        </Col>
      </ScreenScroll>
    </Col>
  );
}
