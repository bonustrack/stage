
import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { ScrollView } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from './SwipeTabs.types';
import { Text } from '@stage-labs/kit/react-native/text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { openDmWithAddress, shortAddress } from '../modules/messaging';
import { flash } from '../lib/toast';
import { useEffectiveColorScheme } from '../lib/theme';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { Avatar } from './Avatar';
import { Box, Col } from './layout';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetRoot } from '@stage-labs/kit/kit';
import { profileHeader } from '@stage-labs/views';
import { ImageViewer } from './ImageViewer';
import {
  ProfileActions, ProfileHeader, useProfileColors, useSelfAddress,
} from './ProfileScreen.parts';
import { CommonChannels } from './CommonChannels';
import { ProfileHoldings } from './ProfileScreen.holdings';

export type ProfileScreenVariant = 'tab' | 'route';

function profileDisplayName(addr: string): string {
  if (!addr) return 'Loading…';
  return getPeerName(addr) ?? shortAddress(addr);
}

function nameNode(name: string): WidgetRoot {
  return { type: 'Basic', children: [profileHeader({ name })] };
}

function ProfileIdentity({ addr, isSelf, dark, opening, c, variant, insetTop, displayName, onAvatar, onCopy, onMessage, onSend }: {
  addr: string; isSelf: boolean; dark: boolean; opening: boolean;
  c: ReturnType<typeof useProfileColors>; variant: ProfileScreenVariant; insetTop: number;
  displayName: string; onAvatar: (uri: string | null) => void; onCopy: () => void;
  onMessage: () => void; onSend: () => void;
}): React.ReactElement {
  return (
    <>
      {}
      <Box height={140 + (variant === 'route' ? insetTop : 0)} background={c.border}/>
      {}
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
        <Box margin={{ top: 14 }} style={{ alignSelf: 'stretch' }}>
          <KitRenderer node={nameNode(displayName)} />
        </Box>
        {addr ? (
          <Pressable onPress={onCopy} hitSlop={8} style={{ marginTop: 2 }}>
            <Text size="md" color={c.text}>{shortAddress(addr)}</Text>
          </Pressable>
        ) : null}
        {}
        {!isSelf && addr ? (
          <ProfileActions dark={dark} opening={opening} c={c} onMessage={onMessage} onSend={onSend} />
        ) : null}
      </Box>
    </>
  );
}

export function ProfileScreen({ address, variant, panRef }: {
  address: string;
  variant: ProfileScreenVariant;
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const c = useProfileColors();

  const addr = address ?? '';
  const self = useSelfAddress();
  const isSelf = !!addr && !!self && addr.toLowerCase() === self.toLowerCase();

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

        {}
        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}

        {}
        {addr ? <ProfileHoldings address={addr} /> : null}
      </ScrollView>

      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => { setViewerUri(null); }}/>
    </Col>
  );
}
