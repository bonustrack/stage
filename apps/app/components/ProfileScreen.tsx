/** Shared profile screen — renders BOTH the logged-in user's own profile and
 *  any peer's public profile. Identity is READ-ONLY and resolved entirely from
 *  stamp.fyi / ENS (display name) + the stamp.fyi identicon (avatar), the same
 *  source used for peers everywhere else. There is no in-app profile editing.
 *  Own-vs-other is decided by comparing the viewed `address` to the active
 *  account's address (resolved from the XMTP client). Own → no Message/Send
 *  (can't message yourself). Other → Message + Send. `variant`: `tab` (footer
 *  Profile, no back button) vs `route` (/user/[address], own back button +
 *  inset). Presentational pieces live in ./ProfileScreen.parts. */

import { useState } from 'react';

import { Pressable } from '@metro-labs/kit/pressable';
import { ScrollView } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { openDmWithAddress, shortAddress } from '../modules/messaging';
import { flash } from '../lib/toast';
import { useEffectiveColorScheme } from '../lib/theme';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { Avatar } from './Avatar';
import { Box, Col } from './layout';
import { ImageViewer } from './ImageViewer';
import {
  ProfileActions, ProfileHeader, useProfileColors, useSelfAddress,
} from './ProfileScreen.parts';
import { CommonChannels } from './CommonChannels';

export type ProfileScreenVariant = 'tab' | 'route';

export function ProfileScreen({ address, variant, panRef }: {
  address: string;
  variant: ProfileScreenVariant;
  /** When mounted inside the swipe pager (Profile tab), the horizontal pager
   *  Pan ref so this screen's ScrollView relates to it simultaneously. */
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const c = useProfileColors();

  const addr = address ?? '';
  const self = useSelfAddress();
  const isSelf = !!addr && !!self && addr.toLowerCase() === self.toLowerCase();

  /** Resolve the display name from stamp.fyi (ENS), same as every peer row. */
  usePeerProfiles([addr]);

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

  const displayName = (addr ? getPeerName(addr) : undefined)
    ?? (addr ? shortAddress(addr) : 'Loading…');

  return (
    <Col flex={1} surface="surface">
      <ProfileHeader
        variant={variant} insetTop={insets.top} c={c}
        onBack={() => router.back()}
      />

      <ScrollView simultaneousHandlers={panRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Full-bleed cover banner (input-bg). For the `route` variant the cover
            extends up behind the floating header/status bar (height += insets.top)
            so the colour bleeds to y=0. Its bottom edge is FLAT — the black content
            sheet below rounds UP over it (inverted/scooped curve), so the gray no
            longer pokes down with rounded corners. */}
        <Box height={140 + (variant === 'route' ? insets.top : 0)} background={c.border}/>
        {/* Content sheet: page-bg block pulled UP 18px to overlap the cover, with
            rounded TOP corners so the black curves over the gray banner (bottom-sheet
            look). overflow:'visible' + avatar zIndex keep the avatar from being
            clipped by the rounding. */}
        <Box surface="surface" padding={{ x: 16, bottom: 8 }} margin={{ top: -18 }} align="start" style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
          {/* Avatar resolves from the stamp.fyi identicon (address fallback) —
              read-only, identical to peer rows. marginTop -88*0.8 pulls it UP by
              80% of its height; zIndex:1 keeps it above the sheet. */}
          <Avatar
            address={addr || null}
            size={88}
            style={{
              backgroundColor: c.border, marginTop: -88 * 0.8, zIndex: 1,
              borderWidth: 3, borderColor: c.bg,
            }}
            onPress={uri => { if (uri) setViewerUri(uri); }}
/>
          <Text weight="semibold" size="4xl" color={c.link} style={{ marginTop: 14 }}>
            {displayName}
          </Text>
          {addr ? (
            <Pressable
              onPress={() => copy(addr, 'Address')}
              hitSlop={8}
              style={{ marginTop: 2 }}
>
              <Text size="md" color={c.text}>
                {shortAddress(addr)}
              </Text>
            </Pressable>
          ) : null}

          {/* Message + Send — only for OTHER users (can't message yourself). */}
          {!isSelf && addr ? (
            <ProfileActions
              dark={dark} opening={openingDm} c={c}
              onMessage={() => { void onMessage(); }}
              onSend={() => router.push({ pathname: '/wallet/send', params: { to: addr } })}
/>
          ) : null}
        </Box>

        {/* Common channels — groups the local user + this peer are BOTH in.
            Only for OTHER users; resolves async so it never blocks the render. */}
        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}
      </ScrollView>

      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => setViewerUri(null)}/>
    </Col>
  );
}
