
import { useEffect, useState } from 'react';

import { Alert, DevSettings } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress, useActiveAccount } from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { flash } from '../../lib/toast';
import { DANGER, useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { MessengerSessions } from './MessengerSessions';

function CopyRow({ label, value, display, c }: {
  label: string; value: string; display: string;
  c: { fg: string; sub: string; border: string; rowBg: string };
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Pressable
      onPress={() => { void Clipboard.setStringAsync(value); flash(`${label} copied`); }}
      style={{
        marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: blockRadius,
        backgroundColor: c.rowBg, borderWidth: 1, borderColor: c.border,
      }}
>
      <Text size="xs" color={c.sub}>{label.toUpperCase()} (tap to copy)</Text>
      <Text size="md" color={c.fg} style={{ marginTop: 2 }}>{display}</Text>
    </Pressable>
  );
}

export function MessengerSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const epoch = useActiveAccount();
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
      } catch { }
    })();
    return () => { alive = false; };
  }, [epoch]);

  const c = { fg, sub, border, rowBg };
  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Messenger" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          XMTP ACCOUNT
        </Text>
        {addr ? <CopyRow label="Your XMTP address" value={addr} display={shortAddress(addr)} c={c} /> : null}
        {inbox ? <CopyRow label="Inbox id" value={inbox} display={inbox} c={c} /> : null}
        {install ? <CopyRow label="Installation id" value={install} display={shortAddress(install)} c={c} /> : null}

        <MessengerSessions />

        <Col padding={{ x: 16 }} margin={{ top: 28 }}>
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
            <Text size="md" color={DANGER}>
              Reset XMTP identity
            </Text>
          </Pressable>
        </Col>
      </ScrollView>
    </Col>
  );
}
