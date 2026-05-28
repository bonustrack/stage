/** Wallet → Receive screen — full-page QR of the logged-in address with the
 *  full address shown below, tap to copy. Replaces the old Alert-on-tap-Receive
 *  flow so users can scan the address into a sender app instead of typing it.
 *
 *  Uses `react-native-qrcode-svg` (pure JS, no native module — no APK rebuild
 *  needed) layered on react-native-svg which the app already depends on. */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';
import { flash } from '../../lib/toast';

export default function WalletReceive(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const card = dark ? '#282a2d' : '#e4e4e5';
  const insets = useSafeAreaInsets();

  const [address, setAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!cancelled) setAddress(client.publicIdentity.identifier);
      } catch { /* leave blank — the parent topnav handles back */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const copy = (): void => {
    if (!address) return;
    void Clipboard.setStringAsync(address);
    flash('Address copied');
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Receive</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', gap: 16 }}>
        {/* QR card — always white background so contrast is correct in dark mode too. */}
        <View style={{
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
            <View style={{ width: 240, height: 240, backgroundColor: '#f4f4f5' }} />
          )}
        </View>

        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 4 }}>
          WALLET ADDRESS (tap to copy)
        </Text>
        <Pressable
          onPress={copy}
          style={({ pressed }) => ({
            width: '100%', padding: 14, borderRadius: 12,
            backgroundColor: pressed ? border : card,
            borderWidth: 1, borderColor: border,
          })}
        >
          <Text style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Medium', textAlign: 'center' }} selectable>
            {address || '—'}
          </Text>
        </Pressable>

        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingHorizontal: 16, marginTop: 8 }}>
          Scan or share this address to receive ETH or tokens on Ethereum mainnet.
        </Text>
      </ScrollView>
    </View>
  );
}
