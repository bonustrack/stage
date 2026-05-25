/** Settings tab — wallet-address copy pill + theme switcher + app version. */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { DevSettings } from 'react-native';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress } from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import {
  setThemePreference, useEffectiveColorScheme, useThemePreference,
  type ThemePreference,
} from '../../lib/theme';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function Settings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const accent = dark ? '#ffffff' : '#1a1f29';

  const [myAddress, setMyAddress] = useState<string>('');
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        setMyAddress(client.publicIdentity.identifier);
      } catch { /* surface elsewhere — settings shouldn't block on XMTP boot */ }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: fg, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Settings</Text>
      </View>

      {myAddress ? (
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(myAddress);
            Alert.alert('Copied', myAddress);
          }}
          style={{
            marginHorizontal: 16, marginTop: 8, padding: 12,
            borderRadius: 12, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border,
          }}
        >
          <Text style={{ color: sub, fontSize: 11 }}>YOUR XMTP ADDRESS (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 13, marginTop: 2 }}>
            {shortAddress(myAddress)}
          </Text>
        </Pressable>
      ) : null}

      <Text style={{ color: sub, fontSize: 11, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
        THEME
      </Text>
      <View style={{
        marginHorizontal: 16, borderRadius: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: border, backgroundColor: rowBg,
      }}>
        {THEME_OPTIONS.map((opt, i) => {
          const selected = pref === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => { void setThemePreference(opt.value); }}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 14,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Text style={{ color: fg, fontSize: 15 }}>{opt.label}</Text>
              {selected ? (
                <Text style={{ color: accent, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>✓</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
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
                      /** Dev-client reload. In a published build this is a no-op;
                       *  swap to expo-updates' reloadAsync if/when we ship one. */
                      DevSettings.reload?.();
                    })();
                  } },
              ],
            );
          }}
          style={({ pressed }) => ({
            padding: 12, borderRadius: 12,
            backgroundColor: pressed ? '#3a2530' : 'transparent',
            borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
            alignItems: 'center',
          })}
        >
          <Text style={{ color: dark ? '#ff6b80' : '#b91c1c', fontSize: 14 }}>
            Reset XMTP identity
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 24, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: sub, fontSize: 11, textAlign: 'center' }}>
          Metro · v{APP_VERSION}
        </Text>
      </View>
    </View>
  );
}
