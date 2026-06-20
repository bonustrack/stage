
import { useEffect, useState } from 'react';

import { Pressable } from '@stage-labs/kit/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { Text } from '@stage-labs/kit/text';
import { Box, Row, Col } from '../../components/layout';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { usePalette } from '../../lib/theme';
import { Icon } from '@stage-labs/kit/icon';
import { flash } from '../../lib/toast';
import { ReceiveModeToggle, type ReceiveMode } from '../../components/wallet/ReceiveModeToggle';

export default function WalletReceive(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const card = border;
  const insets = useSafeAreaInsets();

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

  const activeMode: ReceiveMode = mode === 'private' && !privateReady ? 'public' : mode;
  const address = activeMode === 'private' ? privateAddress : publicAddress;

  const copy = (): void => {
    if (!address) return;
    void Clipboard.setStringAsync(address);
    flash(activeMode === 'private' ? '0zk address copied' : 'Address copied');
  };

  const hint = activeMode === 'private'
    ? 'Shielded address. Funds sent here are private — the sender shields into Railgun.'
    : 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.';

  return (
    <Col surface="surface" flex={1}>
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Text weight="semibold" size="xl" color={head} style={{ flex: 1 }}>Receive</Text>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <ReceiveModeToggle
          mode={activeMode}
          onChange={setMode}
          privateReady={privateReady}
/>

        {}
        <Box background={'#ffffff'} radius="xl" padding={16} align="center" justify="center" style={{ borderWidth: 1, borderColor: border }}>
          {address ? (
            <QRCode
              value={address}
              size={240}
              color="#000000"
              backgroundColor="#ffffff"
/>
          ) : (
            <Box width={240} height={240} background={'#f4f4f5'}/>
          )}
        </Box>

        <Text size="xs" color={sub} style={{ marginTop: 4 }}>
          {activeMode === 'private' ? 'SHIELDED 0ZK ADDRESS (tap to copy)' : 'WALLET ADDRESS (tap to copy)'}
        </Text>
        <Pressable
          onPress={copy}
          style={({ pressed }) => ({
            width: '100%', padding: 14, borderRadius: 12,
            backgroundColor: pressed ? border : card,
            borderWidth: 1, borderColor: border,
          })}
>
          <Text size="md" color={head} style={{ textAlign: 'center' }} selectable>
            {address || '—'}
          </Text>
        </Pressable>

        <Text size="xs" color={sub} style={{ textAlign: 'center', paddingHorizontal: 16, marginTop: 8 }}>
          {hint}
        </Text>
      </ScrollView>
    </Col>
  );
}
