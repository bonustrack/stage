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
import { shortAddress, openDmWithAddress } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { readProfile } from '../../lib/profile';
import { avatarRenderUrl, type SnapshotProfile } from '../../../_shared/profile/snapshot';
import { HeroIcon } from '../../components/HeroIcon';

const AVATAR_SIZE = 120;

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

  const [profile, setProfile] = useState<SnapshotProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openingDm, setOpeningDm] = useState(false);
  useEffect(() => {
    if (!addr) return;
    let cancelled = false;
    void readProfile(addr).then(p => { if (!cancelled) { setProfile(p); setLoaded(true); } });
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
          {/* Wait for the profile so we render the real avatar directly (no
              blockie→real flash); custom avatars resolve via IPFS, not stamp. */}
          {loaded ? (
            <Image
              source={{ uri: avatarRenderUrl(addr, profile?.avatar ?? undefined, AVATAR_SIZE * 2) }}
              style={{
                width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
                backgroundColor: border,
              }}
            />
          ) : (
            <View style={{
              width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
              backgroundColor: border,
            }} />
          )}
          <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
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
              borderRadius: 999, backgroundColor: dark ? '#ffffff' : '#000000',
              opacity: pressed ? 0.85 : openingDm ? 0.6 : 1,
            })}
          >
            <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 15, fontFamily: 'Calibre-Medium' }}>
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
