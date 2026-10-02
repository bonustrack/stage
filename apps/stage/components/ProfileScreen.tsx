
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../lib/safeArea';
import { shortAddress, useActiveAccountRecord } from '../modules/messaging';
import { useEffectiveColorScheme, usePalette, type Palette } from '../lib/theme';
import { usePeerProfiles, getPeerName, getPeerHandle, getPeerDescription } from '../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from './Avatar';
import { Box, Col, ScreenScroll, PAGE_GUTTER } from './layout';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { PEER_PROFILE_MENU, profileDisplayName } from './ProfileScreen.model';
import { capabilities } from '../lib/capabilities';
import { ImageViewer } from './ImageViewer';
import { ProfileActions, useSelfAddress } from './ProfileScreen.parts';
import { PROFILE_AVATAR_SIZE, ProfileCover, ProfileCoverBar, ProfileCoverMenu } from './ProfileCover';
import { CommonChannels } from './CommonChannels';
import { Button } from '@stage-labs/kit/react-native/button';
import { EditProfileModal } from './settings/EditProfileModal';
import { CENTERED } from './RoundIconButton';

function EditProfileButton({ background }: { background: string }): React.ReactElement {
  const address = useActiveAccountRecord()?.address ?? null;
  const handle = getPeerHandle(address);
  const dark = useEffectiveColorScheme() === 'dark';
  const [editing, setEditing] = useState(false);
  const onEdit = (): void => {
    if (address && handle) setEditing(true);
    else capabilities.navigate('/settings/profile');
  };
  return (
    <>
      <Button label="Edit profile" color="secondary" variant="solid" dark={dark} tintBg={background} tintPressedBg={background} style={{ ...CENTERED, borderColor: background }} onPress={onEdit} />
      {address && handle ? (
        <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} />
      ) : null}
    </>
  );
}

function ProfileMenu({ isSelf, onSelect }: { isSelf: boolean; onSelect: (id: string) => void }): React.ReactElement {
  const { bg } = usePalette();
  if (isSelf) return <EditProfileButton background={bg} />;
  return <ProfileCoverMenu items={PEER_PROFILE_MENU} onSelect={onSelect} />;
}

function ProfileIdentity({ addr, isSelf, dark, c, insetTop, displayName, handle, about, onAvatar, onMessage, onSend }: {
  addr: string; isSelf: boolean; dark: boolean;
  c: Palette; insetTop: number;
  displayName: string; handle?: string; about?: string; onAvatar: (uri: string | null) => void;
  onMessage: () => void; onSend: () => void;
}): React.ReactElement {
  return (
    <>
      <ProfileCover
        insetTop={insetTop}
        avatar={
          <Avatar
            address={addr || null}
            size={PROFILE_AVATAR_SIZE}
            style={{ backgroundColor: c.border, borderWidth: 3, borderColor: c.bg }}
            onPress={onAvatar}
          />
        }
      >
        <Box padding={{ x: PAGE_GUTTER, bottom: 8 }} align="start">
          <Box margin={{ top: 14 }} style={{ alignSelf: 'stretch' }}>
            <Col gap={6} align="start">
              <Text value={displayName} weight="semibold" size="2xl" textAlign="start" />
              {handle && displayHandle(handle) !== displayName ? <Text value={displayHandle(handle)} size="2xs" color={c.text} /> : null}
              {about ? <Text value={about} size="xl" textAlign="start" /> : null}
            </Col>
          </Box>
          {addr ? (
            <Box margin={{ top: 2 }}>
              <GesturePressable hitSlop={8} onPress={() => { capabilities.copy('Address', addr); }}>
                <Text value={shortAddress(addr)} size="2xs" color={c.text} />
              </GesturePressable>
            </Box>
          ) : null}
          {!isSelf && addr ? (
            <ProfileActions dark={dark} c={c} onMessage={onMessage} onSend={onSend} />
          ) : null}
        </Box>
      </ProfileCover>
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

  const onSend = (): void => { router.push({ pathname: '/wallet/send', params: { to: addr } }); };
  const menuActions: Record<string, () => void> = {
    message: onMessage, send: onSend, 'copy-address': () => { capabilities.copy('Address', addr); },
  };

  const displayName = profileDisplayName(addr, getPeerName(addr), shortAddress(addr));

  return (
    <Col flex={1} surface="surface">
      <ProfileCoverBar insetTop={insets.top} trailing={addr ? <ProfileMenu isSelf={isSelf} onSelect={(id) => { menuActions[id]?.(); }} /> : undefined} />

      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileIdentity
          addr={addr} isSelf={isSelf} dark={dark} c={c}
          insetTop={insets.top} displayName={displayName}
          handle={getPeerHandle(addr)} about={getPeerDescription(addr)}
          onAvatar={uri => { if (uri) setViewerUri(uri); }}
          onMessage={onMessage}
          onSend={onSend}
        />

        {!isSelf && addr ? <CommonChannels peerAddress={addr} enabled={!isSelf} c={c} /> : null}
      </ScreenScroll>

      <ImageViewer uri={viewerUri ?? ''} visible={viewerUri !== null} onClose={() => { setViewerUri(null); }}/>
    </Col>
  );
}
