/** Settings tab — wallet-address copy pill + theme switcher + app version. */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { DevSettings } from 'react-native';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { resetAccount } from '../../lib/wallet';
import { AccountsManager } from '../../components/AccountsManager';
import { HeroIcon } from '../../components/HeroIcon';
import {
  setThemePreference, useEffectiveColorScheme, useThemePreference,
  type ThemePreference,
} from '../../lib/theme';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

import type { HeroIconName } from '../../components/HeroIcon';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];

export default function Settings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';

  const [myAddress, setMyAddress] = useState<string>('');
  const [myInboxId, setMyInboxId] = useState<string>('');
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        setMyAddress(client.publicIdentity.identifier);
        setMyInboxId(client.inboxId);
      } catch { /* surface elsewhere — settings shouldn't block on XMTP boot */ }
    })();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Settings</Text>
      </View>

      {myAddress ? (
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(myAddress);
            flash('Address copied');
          }}
          style={{
            marginHorizontal: 16, marginTop: 8, padding: 12,
            borderRadius: 12, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border,
          }}
        >
          <Text style={{ color: sub, fontSize: 13 , fontFamily: 'Calibre-Medium'}}>YOUR XMTP ADDRESS (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 16, marginTop: 2 , fontFamily: 'Calibre-Medium'}}>
            {shortAddress(myAddress)}
          </Text>
        </Pressable>
      ) : null}

      {myInboxId ? (
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(myInboxId);
            flash('Inbox id copied');
          }}
          style={{
            marginHorizontal: 16, marginTop: 8, padding: 12,
            borderRadius: 12, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border,
          }}
        >
          <Text style={{ color: sub, fontSize: 13 , fontFamily: 'Calibre-Medium'}}>YOUR XMTP INBOX ID (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 16, marginTop: 2 , fontFamily: 'Calibre-Medium'}}>
            {myInboxId}
          </Text>
        </Pressable>
      ) : null}

      <AccountsManager dark={dark} />

      <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 , fontFamily: 'Calibre-Medium'}}>
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
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <HeroIcon name={opt.icon} size={22} color={head} />
              <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Medium', flex: 1 }}>{opt.label}</Text>
              {selected ? (
                <HeroIcon name="check" size={20} color={head} />
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
            padding: 12, borderRadius: 999,
            backgroundColor: pressed ? '#3a2530' : 'transparent',
            borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
            alignItems: 'center',
          })}
        >
          <Text style={{ color: dark ? '#ff6b80' : '#b91c1c', fontSize: 16 , fontFamily: 'Calibre-Medium'}}>
            Reset XMTP identity
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 24, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: sub, fontSize: 11, textAlign: 'center' , fontFamily: 'Calibre-Medium'}}>
          Metro · v{APP_VERSION}
        </Text>
      </View>
    </ScrollView>
  );
}
