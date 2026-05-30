/** Shared profile screen — renders BOTH the logged-in user's own profile and
 *  any peer's public profile. Own-vs-other is decided by comparing the viewed
 *  `address` to the active account's address (resolved from the XMTP client).
 *  Own → overflow "Edit profile" menu, no Message/Send. Other → Message + Send,
 *  no edit menu. `variant`: `tab` (footer Profile, no back button — inset baked
 *  into the tab scene) vs `route` (/user/[address], own back button + inset).
 *  Presentational pieces live in ./ProfileScreen.parts to keep this under cap. */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import {
  getCachedXmtpClient, getOrCreateXmtpClient, openDmWithAddress, shortAddress,
} from '../lib/xmtp';
import { flash } from '../lib/toast';
import { useEffectiveColorScheme } from '../lib/theme';
import { useProfileQuery } from '../lib/useProfile';
import EditProfileModal from './EditProfileModal';
import { HeroIcon } from './HeroIcon';
import { Avatar } from './Avatar';
import { ImageViewer } from './ImageViewer';
import {
  EditMenu, InfoRow, ProfileActions, useProfileColors,
} from './ProfileScreen.parts';
import { CommonChannels } from './CommonChannels';

export type ProfileScreenVariant = 'tab' | 'route';

/** Resolve the active account's address: cached client first (synchronous, so
 *  own-vs-other settles on first paint when the client is already up), then a
 *  best-effort async fetch on cold start. */
function useSelfAddress(): string {
  const cached = getCachedXmtpClient();
  const [self, setSelf] = useState(cached?.publicIdentity.identifier ?? '');
  useEffect(() => {
    if (self) return;
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (alive) setSelf(client.publicIdentity.identifier);
      } catch { /* leave blank — treat as other until resolved */ }
    })();
    return () => { alive = false; };
  }, [self]);
  return self;
}

export function ProfileScreen({ address, variant }: {
  address: string;
  variant: ProfileScreenVariant;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const dark = useEffectiveColorScheme() === 'dark';
  const c = useProfileColors();

  const addr = address ?? '';
  const self = useSelfAddress();
  const isSelf = !!addr && !!self && addr.toLowerCase() === self.toLowerCase();

  const { data: profile, isSuccess: loaded } = useProfileQuery(addr);

  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openingDm, setOpeningDm] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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

  const copy = (value: string, label = 'Address'): void => {
    void Clipboard.setStringAsync(value);
    flash(`${label} copied`);
  };

  const displayName = profile?.name?.trim() || (addr ? shortAddress(addr) : 'Loading…');
  const headerTop = variant === 'route' ? 44 + insets.top : 56;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header — variant-specific. Both expose the own-profile overflow menu
          (edit) on the right; the route variant adds a back button on the left. */}
      <View style={{
        ...(variant === 'route'
          ? { height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14 }
          : { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }),
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {variant === 'route' ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
            <HeroIcon name="arrowLeft" size={22} color={c.fg} />
          </Pressable>
        ) : (
          <Text style={{ color: c.head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Profile</Text>
        )}

        {isSelf ? (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={{ padding: 6 }}>
            <HeroIcon name="dotsHorizontal" size={22} color={c.head} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          {/* Wait for the profile so we render the real avatar directly (no
              blockie→real flash); custom avatars resolve via IPFS, not stamp. */}
          <Avatar
            address={loaded && addr ? addr : null}
            imageUri={loaded ? profile?.avatar : null}
            size={128}
            style={{ backgroundColor: c.rowBg }}
            onPress={uri => { if (uri) setViewerUri(uri); }}
          />
          <Text style={{ color: c.head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
            {displayName}
          </Text>
          {profile?.about?.trim() ? (
            <Text style={{
              color: c.sub, fontSize: 14, marginTop: 6, textAlign: 'left',
              fontFamily: 'Calibre-Medium',
            }}>
              {profile.about}
            </Text>
          ) : null}

          {/* Message + Send — only for OTHER users (can't message yourself). */}
          {!isSelf && addr ? (
            <ProfileActions
              dark={dark} opening={openingDm} c={c}
              onMessage={() => { void onMessage(); }}
              onSend={() => router.push({ pathname: '/wallet/send', params: { to: addr } })}
            />
          ) : null}
        </View>

        {addr ? <InfoRow label="Wallet address" value={addr} onCopy={() => copy(addr, 'Address')} c={c} /> : null}

        {profile?.github?.trim() ? <InfoRow label="GitHub" value={profile.github} c={c} /> : null}
        {profile?.twitter?.trim() ? <InfoRow label="X (Twitter)" value={profile.twitter} c={c} /> : null}
        {profile?.lens?.trim() ? <InfoRow label="Lens" value={profile.lens} c={c} /> : null}
        {profile?.farcaster?.trim() ? <InfoRow label="Farcaster" value={profile.farcaster} c={c} /> : null}

        {/* Common channels — groups the local user + this peer are BOTH in.
            Only for OTHER users; resolves async so it never blocks the render. */}
        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}
      </ScrollView>

      {isSelf ? (
        <EditMenu
          visible={menuOpen} top={headerTop + 4} c={c}
          onClose={() => setMenuOpen(false)}
          onEdit={() => { setMenuOpen(false); setEditing(true); }}
        />
      ) : null}

      <EditProfileModal
        visible={editing} onClose={() => setEditing(false)}
        onSaved={next => {
          /* Seed the query cache so the unified screen reflects the edit
             immediately, then revalidate against the hub in the background. */
          queryClient.setQueryData(['profile', addr.toLowerCase()], next);
          void queryClient.invalidateQueries({ queryKey: ['profile', addr.toLowerCase()] });
        }}
        address={addr} initial={profile ?? {}} dark={dark}
      />
      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => setViewerUri(null)} />
    </View>
  );
}
