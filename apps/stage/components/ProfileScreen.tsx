
import { useState } from 'react';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../lib/safeArea';
import { shortAddress } from '../modules/messaging';
import { useEffectiveColorScheme, usePalette, type Palette } from '../lib/theme';
import { usePeerProfiles, getPeerName, getPeerHandle, getPeerDescription } from '../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from './Avatar';
import { Box, Col, ScreenScroll } from './layout';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { profileDisplayName } from './ProfileScreen.model';
import { capabilities } from '../lib/capabilities';
import { ImageViewer } from './ImageViewer';
import {
  ProfileActions, ProfileHeader, useSelfAddress,
} from './ProfileScreen.parts';
import { CommonChannels } from './CommonChannels';
import { ProfileHoldings } from './ProfileScreen.holdings';
import { ProfileMenu } from './ProfileMenu';

function copyAddress(address: string): void {
  void capabilities.copyToClipboard(address);
  capabilities.toast('Address copied');
}

function ProfileIdentity({ addr, isSelf, dark, c, insetTop, displayName, handle, about, onAvatar, onMessage, onSend }: {
  addr: string; isSelf: boolean; dark: boolean;
  c: Palette; insetTop: number;
  displayName: string; handle?: string; about?: string; onAvatar: (uri: string | null) => void;
  onMessage: () => void; onSend: () => void;
}): React.ReactElement {
  return (
    <>
      <Box height={140 + insetTop} background={c.border}/>
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
          <Col gap={6} align="start">
            <Text value={displayName} weight="semibold" size="5xl" textAlign="start" />
            {handle && displayHandle(handle) !== displayName ? <Text value={displayHandle(handle)} size="md" color={c.text} /> : null}
            {about ? <Text value={about} size="4xl" textAlign="start" /> : null}
          </Col>
        </Box>
        {addr ? (
          <Box margin={{ top: 2 }}>
            <GesturePressable hitSlop={8} onPress={() => { copyAddress(addr); }}>
              <Text value={shortAddress(addr)} size="md" color={c.text} />
            </GesturePressable>
          </Box>
        ) : null}
        {!isSelf && addr ? (
          <ProfileActions dark={dark} c={c} onMessage={onMessage} onSend={onSend} />
        ) : null}
      </Box>
    </>
  );
}

export function ProfileScreen({ address }: { address: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const c = usePalette();

  const addr = address ?? '';
  const self = useSelfAddress();
  const isSelf = !!addr && !!self && addr.toLowerCase() === self.toLowerCase();

  usePeerProfiles([addr]);

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const onMessage = (): void => {
    if (!addr) return;
    router.replace({ pathname: '/[convId]', params: { convId: addr } });
  };

  const displayName = profileDisplayName(addr, getPeerName(addr), shortAddress(addr));

  return (
    <Col flex={1} surface="surface">
      <ProfileHeader insetTop={insets.top} c={c} menu={<ProfileMenu color={c.link} isSelf={isSelf} />} />

      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileIdentity
          addr={addr} isSelf={isSelf} dark={dark} c={c}
          insetTop={insets.top} displayName={displayName}
          handle={getPeerHandle(addr)} about={getPeerDescription(addr)}
          onAvatar={uri => { if (uri) setViewerUri(uri); }}
          onMessage={onMessage}
          onSend={() => { router.push({ pathname: '/wallet/send', params: { to: addr } }); }}
        />

        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}

        {addr ? <ProfileHoldings address={addr} /> : null}
      </ScreenScroll>

      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => { setViewerUri(null); }}/>
    </Col>
  );
}
