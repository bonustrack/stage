/** Read-only public profile view for a peer's Ethereum address. Opened from
 *  any avatar tap in the messenger; mirrors the Profile tab layout but
 *  without edit controls. */

import { useEffect, useState } from 'react';
import {
  Image, Pressable, ScrollView, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { shortAddress, stampBoxAvatarUrl, openDmWithAddress } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { readProfile } from '../../lib/profile';
import { type SnapshotProfile } from '../../../_shared/profile/snapshot';
import { HeroIcon } from '../../components/HeroIcon';

const AVATAR_SIZE = 120;

export default function UserProfileView(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';

  const { address } = useLocalSearchParams<{ address: string }>();
  const addr = address ?? '';

  const [profile, setProfile] = useState<SnapshotProfile | null>(null);
  const [openingDm, setOpeningDm] = useState(false);
  useEffect(() => {
    if (!addr) return;
    let cancelled = false;
    void readProfile(addr).then(p => { if (!cancelled) setProfile(p); });
    return (): void => { cancelled = true; };
  }, [addr]);

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
          <Image
            source={{ uri: stampBoxAvatarUrl(addr, AVATAR_SIZE * 2) }}
            style={{
              width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
              backgroundColor: '#1a1f29',
            }}
          />
          <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
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
          <Pressable
            onPress={() => { void onMessage(); }}
            disabled={openingDm}
            style={({ pressed }) => ({
              marginTop: 18, paddingHorizontal: 28, paddingVertical: 12,
              borderRadius: 999, backgroundColor: '#ffffff',
              shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
              elevation: 4,
              opacity: pressed ? 0.85 : openingDm ? 0.6 : 1,
            })}
          >
            <Text style={{ color: '#000000', fontSize: 15, fontFamily: 'Calibre-Medium' }}>
              {openingDm ? 'Opening…' : 'Message'}
            </Text>
          </Pressable>
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
