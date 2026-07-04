
import { useEffect, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../../components/layout';
import { WalletHeader } from '../../components/wallet/WalletHeader';
import { WalletIcon } from '../../components/wallet/widgets';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { usePalette } from '../../lib/theme';
import { ReceiveModeToggle, type ReceiveMode } from '../../components/wallet/ReceiveModeToggle';
import { receiveViewModel } from '@stage-labs/client/wallet/receive';

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
        <WalletIcon name="copy" color="secondary" size={16} />
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

  const [mode, setMode] = useState<ReceiveMode>('public');
  const [publicAddress, setPublicAddress] = useState('');
  const { snapshot } = usePrivateWallet();
  const privateAddress = snapshot?.zkAddress ?? '';
  const privateReady = privateAddress.length> 0;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!cancelled) setPublicAddress(client.publicIdentity.identifier);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, []);

  const { activeMode, address, label, hint } = receiveViewModel({
    mode, publicAddress, privateAddress, privateReady,
  });

  const onCopy = (): void => {
    if (!address) return;
    void capabilities.copyToClipboard(address);
    capabilities.toast(activeMode === 'private' ? '0zk address copied' : 'Address copied');
  };

  return (
    <Col surface="surface" flex={1}>
      <WalletHeader title="Receive" />

      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <ReceiveModeToggle
          mode={activeMode}
          onChange={setMode}
          privateReady={privateReady}
/>

        <Col width="100%">
          <Col align="center" gap={16}>
            <QrPanel address={address} border={border} />
            <AddressCard label={label} address={address || '—'} hint={hint} onCopy={onCopy} />
          </Col>
        </Col>
      </ScrollView>
    </Col>
  );
}
