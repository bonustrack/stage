/**
 * @file ProfileScreen: the shared profile screen rendering both the user's own profile and any peer's public profile, as a tab or standalone route.
 */

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
import { ProfileHoldings } from './ProfileScreen.holdings';

export type ProfileScreenVariant = 'tab' | 'route';

/** Resolve the display name for a profile address (peer name, short address, or loading). */
function profileDisplayName(addr: string): string {
  if (!addr) return 'Loading…';
  return getPeerName(addr) ?? shortAddress(addr);
}

/** Renders the identity content sheet (avatar, name, address, action buttons) of the profile. */
function ProfileIdentity({ addr, isSelf, dark, opening, c, variant, insetTop, displayName, onAvatar, onCopy, onMessage, onSend }: {
  addr: string; isSelf: boolean; dark: boolean; opening: boolean;
  c: ReturnType<typeof useProfileColors>; variant: ProfileScreenVariant; insetTop: number;
  displayName: string; onAvatar: (uri: string | null) => void; onCopy: () => void;
  onMessage: () => void; onSend: () => void;
}): React.ReactElement {
  return (
    <>
      {/* Full-bleed cover banner (input-bg), flat bottom edge scooped by the sheet below. */}
      <Box height={140 + (variant === 'route' ? insetTop : 0)} background={c.border}/>
      {/* Content sheet pulled UP 18px to overlap the cover with rounded top corners. */}
      <Box surface="surface" padding={{ x: 16, bottom: 8 }} margin={{ top: -18 }} align="start" style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
        <Avatar
          address={addr || null}
          size={88}
          style={{
            backgroundColor: c.border, marginTop: -88 * 0.8, zIndex: 1,
            borderWidth: 3, borderColor: c.bg,
          }}
          onPress={onAvatar}
/>
        <Text weight="semibold" size="4xl" color={c.link} style={{ marginTop: 14 }}>
          {displayName}
        </Text>
        {addr ? (
          <Pressable onPress={onCopy} hitSlop={8} style={{ marginTop: 2 }}>
            <Text size="md" color={c.text}>{shortAddress(addr)}</Text>
          </Pressable>
        ) : null}
        {/* Message + Send — only for OTHER users (can't message yourself). */}
        {!isSelf && addr ? (
          <ProfileActions dark={dark} opening={opening} c={c} onMessage={onMessage} onSend={onSend} />
        ) : null}
      </Box>
    </>
  );
}

/** Renders a user's profile, either as a tab or a standalone route. */
export function ProfileScreen({ address, variant, panRef }: {
  address: string;
  variant: ProfileScreenVariant;
  /** When mounted inside the swipe pager (Profile tab), the horizontal pager Pan ref so this screen's ScrollView relates to it simultaneously. */
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

  /** Handle the Message. */
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

  /** Copy helper. */
  const copy = (value: string, label = 'Address'): void => {
    void Clipboard.setStringAsync(value);
    flash(`${label} copied`);
  };

  const displayName = profileDisplayName(addr);

  return (
    <Col flex={1} surface="surface">
      <ProfileHeader
        variant={variant} insetTop={insets.top} c={c}
        onBack={() => { router.back(); }}
      />

      <ScrollView simultaneousHandlers={panRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileIdentity
          addr={addr} isSelf={isSelf} dark={dark} opening={openingDm} c={c}
          variant={variant} insetTop={insets.top} displayName={displayName}
          onAvatar={uri => { if (uri) setViewerUri(uri); }}
          onCopy={() => { copy(addr, 'Address'); }}
          onMessage={() => { void onMessage(); }}
          onSend={() => { router.push({ pathname: '/wallet/send', params: { to: addr } }); }}
        />

        {/* Common channels — groups the local user + this peer are BOTH in.
            Only for OTHER users; resolves async so it never blocks the render. */}
        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}

        {/* Tokens + NFTs holdings for the VIEWED address — reuses the Wallet
            tab's TokensList / NftsView (public balances only; no Railgun). */}
        {addr ? <ProfileHoldings address={addr} /> : null}
      </ScrollView>

      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => { setViewerUri(null); }}/>
    </Col>
  );
}
