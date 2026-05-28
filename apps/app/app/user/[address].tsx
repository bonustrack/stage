/** Read-only public profile view for a peer's Ethereum address. Opened from
 *  any avatar tap in the messenger; mirrors the Profile tab layout but
 *  without edit controls. */

import { useState } from 'react';
import {
  Pressable, ScrollView, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { shortAddress, openDmWithAddress } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useProfileQuery } from '../../lib/useProfile';
import { HeroIcon } from '../../components/HeroIcon';
import { Avatar } from '../../components/Avatar';

export default function UserProfileView(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';

  const { address } = useLocalSearchParams<{ address: string }>();
  const addr = address ?? '';

  const { data: profile, isSuccess: loaded } = useProfileQuery(addr);
  const [openingDm, setOpeningDm] = useState(false);

  const onMessage = async (): Promise<void> => {
    if (!addr || openingDm) return;
    setOpeningDm(true);
    try {
      const convId = await openDmWithAddress(addr);
      router.replace({ pathname: '/xmtp/[convId]', params: { convId } });
    } catch (e) {
      console.warn('openDmWithAddress failed', (e as Error).message);
    } finally { setOpeningDm(false); }
  };

  const copy = (value: string): void => { void Clipboard.setStringAsync(value); };

  const Row = ({ label, value }: { label: string; value: string }): React.ReactElement => (
    <View style={{
      marginHorizontal: 16, marginTop: 12, padding: 12,
      borderRadius: 12, backgroundColor: rowBg, borderWidth: 1, borderColor: border,
    }}>
      <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Medium' }}>{label.toUpperCase()}</Text>
      <Text style={{ color: fg, fontSize: 14, marginTop: 4, fontFamily: 'Calibre-Medium' }} selectable>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{
        height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8 }}>
          {/* Wait for the profile so we render the real avatar directly (no
              blockie→real flash); custom avatars resolve via IPFS, not stamp. */}
          <Avatar
            address={loaded ? addr : null}
            imageUri={profile?.avatar}
            size={128}
            style={{ backgroundColor: border }}
          />
          <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
            {profile?.name?.trim() || shortAddress(addr)}
          </Text>
          {profile?.about?.trim() ? (
            <Text style={{
              color: sub, fontSize: 14, marginTop: 6, paddingHorizontal: 32, textAlign: 'center',
              fontFamily: 'Calibre-Medium',
            }}>
              {profile.about}
            </Text>
          ) : null}
          {/* Action row — Message (opens or creates a DM) + Send (jumps into
              the wallet Send form with this address prefilled). The pair sits
              on the same row so neither dominates the header. */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 24 }}>
            <Pressable
              onPress={() => { void onMessage(); }}
              disabled={openingDm}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 12, alignItems: 'center',
                borderRadius: 999, backgroundColor: dark ? '#ffffff' : '#000000',
                opacity: pressed ? 0.85 : openingDm ? 0.6 : 1,
              })}
            >
              <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                {openingDm ? 'Opening…' : 'Message'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/wallet/send', params: { to: addr } })}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 12, alignItems: 'center',
                borderRadius: 999, backgroundColor: pressed ? border : rowBg,
                borderWidth: 1, borderColor: border,
              })}
            >
              <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>Send</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => copy(addr)}>
          <Row label="Wallet address (tap to copy)" value={addr} />
        </Pressable>

        {profile?.github?.trim() ? <Row label="GitHub" value={profile.github} /> : null}
        {profile?.twitter?.trim() ? <Row label="X (Twitter)" value={profile.twitter} /> : null}
        {profile?.lens?.trim() ? <Row label="Lens" value={profile.lens} /> : null}
        {profile?.farcaster?.trim() ? <Row label="Farcaster" value={profile.farcaster} /> : null}
      </ScrollView>
    </View>
  );
}
