/** Wallet → Receive screen — full-page QR of the logged-in address with the
 *  full address shown below, tap to copy. A Public/Private toggle at the top
 *  switches between the public EOA address (0x…) and the shielded Railgun 0zk
 *  address. Funds received to the 0zk address are private (shielded).
 *
 *  Uses `react-native-qrcode-svg` (pure JS, no native module — no APK rebuild
 *  needed) layered on react-native-svg which the app already depends on. */

import { useEffect, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { usePalette } from '../../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { flash } from '../../lib/toast';
import { ReceiveModeToggle, type ReceiveMode } from '../../components/wallet/ReceiveModeToggle';

export default function WalletReceive(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, bg, border, toolbarBg } = usePalette();
  const sub = fg;
  const card = border;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<ReceiveMode>('public');
  const [publicAddress, setPublicAddress] = useState('');
  const { snapshot } = usePrivateWallet();
  const privateAddress = snapshot?.zkAddress ?? '';
  const privateReady = privateAddress.length > 0;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!cancelled) setPublicAddress(client.publicIdentity.identifier);
      } catch { /* leave blank — the parent topnav handles back */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fall back to public if private was selected but the 0zk address vanished.
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
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
        backgroundColor: toolbarBg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: fontSize('lg'), fontFamily: 'Calibre-Semibold', flex: 1 }}>Receive</Text>
      </Box>

      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        <ReceiveModeToggle
          mode={activeMode}
          onChange={setMode}
          privateReady={privateReady}
        />

        {/* QR card — always white background so contrast is correct in dark mode too. */}
        <Box style={{
          backgroundColor: '#ffffff', padding: 16, borderRadius: 16,
          borderWidth: 1, borderColor: border,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {address ? (
            <QRCode
              value={address}
              size={240}
              color="#000000"
              backgroundColor="#ffffff"
            />
          ) : (
            <Box style={{ width: 240, height: 240, backgroundColor: '#f4f4f5' }} />
          )}
        </Box>

        <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium', marginTop: 4 }}>
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
          <Text style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium', textAlign: 'center' }} selectable>
            {address || '—'}
          </Text>
        </Pressable>

        <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium', textAlign: 'center', paddingHorizontal: 16, marginTop: 8 }}>
          {hint}
        </Text>
      </ScrollView>
    </Box>
  );
}
