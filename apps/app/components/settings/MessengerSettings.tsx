/** Settings → Messenger — XMTP account info (address, inbox id, installation
 *  id — tap to copy) + the floating-voice-pill grant + the "Reset XMTP
 *  identity" flow. All real, existing data/behaviour pulled out of the old flat
 *  Settings tab; no invented toggles. */

import { useEffect, useState } from 'react';
import { Alert, DevSettings, Pressable, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress } from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import { flash } from '../../lib/toast';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';

function CopyRow({ label, value, display, c }: {
  label: string; value: string; display: string;
  c: { fg: string; sub: string; border: string; rowBg: string };
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Clipboard.setStringAsync(value); flash(`${label} copied`); }}
      style={{
        marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12,
        backgroundColor: c.rowBg, borderWidth: 1, borderColor: c.border,
      }}
    >
      <Text style={{ color: c.sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{label.toUpperCase()} (tap to copy)</Text>
      <Text style={{ color: c.fg, fontSize: 16, marginTop: 2, fontFamily: 'Calibre-Medium' }}>{display}</Text>
    </Pressable>
  );
}

export function MessengerSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const epoch = useAccountEpoch();
  const [addr, setAddr] = useState('');
  const [inbox, setInbox] = useState('');
  const [install, setInstall] = useState('');

  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!alive) return;
        setAddr(client.publicIdentity.identifier);
        setInbox(client.inboxId);
        setInstall(client.installationId ?? '');
      } catch { /* settings shouldn't block on XMTP boot */ }
    })();
    return () => { alive = false; };
  }, [epoch]);

  const c = { fg, sub, border, rowBg };
  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Messenger" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 20, fontFamily: 'Calibre-Medium' }}>
          XMTP ACCOUNT
        </Text>
        {addr ? <CopyRow label="Your XMTP address" value={addr} display={shortAddress(addr)} c={c} /> : null}
        {inbox ? <CopyRow label="Inbox id" value={inbox} display={inbox} c={c} /> : null}
        {install ? <CopyRow label="Installation id" value={install} display={shortAddress(install)} c={c} /> : null}

        <Col mt={28} px={16}>
          <Pressable
            onPress={() => {
              Alert.alert(
                'Reset XMTP identity',
                'This wipes the local wallet + XMTP database. You will get a fresh inbox on next launch. Existing conversations on this device will become unreachable.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => {
                      void (async (): Promise<void> => {
                        await resetXmtpClient();
                        await resetAccount();
                        DevSettings.reload?.();
                      })();
                    } },
                ],
              );
            }}
            style={({ pressed }) => ({
              padding: 12, borderRadius: 999, alignItems: 'center',
              backgroundColor: pressed ? '#3a2530' : 'transparent',
              borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
            })}
          >
            <Text style={{ color: DANGER, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
              Reset XMTP identity
            </Text>
          </Pressable>
        </Col>
      </ScrollView>
    </Box>
  );
}
