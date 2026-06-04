/** Settings tab — wallet-address copy pill + theme switcher + app version. */

import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { DevSettings } from 'react-native';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { resetAccount } from '../../lib/wallet';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { Icon } from '@metro-labs/kit/icon';
import { Col } from '../layout';
import {
  setThemePreference, useEffectiveColorScheme, usePalette, useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from './SettingsScreen.parts';
import { AccountSecuritySection } from './SettingsScreen.account';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

export function SettingsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const { fg, head, sub, bg, border, rowBg } = usePalette();

  /** Re-fetch the active account's address/inbox whenever the active account
   *  switches (AccountsManager bumps this on an in-place switch). */
  const accountEpoch = useAccountEpoch();
  const [myAddress, setMyAddress] = useState<string>('');
  const [myInboxId, setMyInboxId] = useState<string>('');

  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (!alive) return;
        setMyAddress(client.publicIdentity.identifier);
        setMyInboxId(client.inboxId);
      } catch { /* surface elsewhere — settings shouldn't block on XMTP boot */ }
    })();
    return () => { alive = false; };
  }, [accountEpoch]);

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Col px={16} pt={16} pb={8}>
        <Title dark={dark} style={{ color: head, fontSize: 22 }}>Settings</Title>
      </Col>

      {/* Account switching now lives in the topnav-avatar modal on the
          Channels tab — Settings keeps just the active account's pills. */}
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

      <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 , fontFamily: 'Calibre-Medium'}}>
        THEME
      </Text>
      <Col mx={16} radius={12} bg={rowBg} style={{
        overflow: 'hidden',
        borderWidth: 1, borderColor: border,
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
              <Icon name={opt.icon} size={22} color={head} />
              <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Medium', flex: 1 }}>{opt.label}</Text>
              {selected ? (
                <Icon name="check" size={20} color={head} />
              ) : null}
            </Pressable>
          );
        })}
      </Col>

      <AccountSecuritySection
        c={{ fg, head, sub, border, rowBg }}
        danger={dark ? '#ff6b80' : '#b91c1c'}
      />

      <Col mt={32} px={16}>
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
      </Col>

      <Col mt={24} px={16} pb={16}>
        <Text style={{ color: sub, fontSize: 11, textAlign: 'center' , fontFamily: 'Calibre-Medium'}}>
          Metro · v{APP_VERSION}
        </Text>
      </Col>
    </ScrollView>
  );
}
