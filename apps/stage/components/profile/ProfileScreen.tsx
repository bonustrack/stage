import { useState } from 'react';
import { useRouter } from 'expo-router';
import { dmLinkOf } from '../../lib/links';
import { useSafeAreaInsets } from '../layout/safeArea';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useEffectiveColorScheme, usePalette, type Palette } from '../../lib/theme';
import { usePeerProfiles, getPeerName, getPeerHandle, getPeerDescription } from '../../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from '../Avatar';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { PEER_PROFILE_MENU, profileDisplayName, type PeerProfileId } from './ProfileScreen.model';
import type { MenuActions } from '../MenuRows';
import { capabilities } from '../../lib/capabilities';
import { ImageViewer } from '../media/ImageViewer';
import { ProfileActions } from './ProfileScreen.parts';
import { useSelfAddress } from '../../lib/messaging/account';
import { PROFILE_AVATAR_SIZE, ProfileCover, ProfileCoverBar, ProfileCoverMenu } from './ProfileCover';
import { CommonChannels } from './CommonChannels';
import { Button } from '@stage-labs/kit/react-native/button';
import { useEditProfile } from './useEditProfile';
import { CENTERED } from '../RoundIconButton';
import { Column, ScreenScroll, PAGE_GUTTER } from '../layout';

function EditProfileButton({ background }: { background: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const editProfile = useEditProfile(true);
  return (
    <>
      <Button
        label="Edit profile"
        color="secondary"
        variant="solid"
        dark={dark}
        tintBg={background}
        tintPressedBg={background}
        style={{ ...CENTERED, borderColor: background }}
        onPress={editProfile.open}
      />
      {editProfile.modal}
    </>
  );
}

function ProfileMenu({ isSelf, actions }: { isSelf: boolean; actions: MenuActions<PeerProfileId> }): React.ReactElement {
  const { bg } = usePalette();
  if (isSelf) return <EditProfileButton background={bg} />;
  return <ProfileCoverMenu items={PEER_PROFILE_MENU} actions={actions} />;
}

function ProfileIdentity({
  addr,
  isSelf,
  dark,
  c,
  insetTop,
  displayName,
  handle,
  about,
  onAvatar,
  onMessage,
  onSend,
}: {
  addr: string;
  isSelf: boolean;
  dark: boolean;
  c: Palette;
  insetTop: number;
  displayName: string;
  handle?: string;
  about?: string;
  onAvatar: (uri: string | null) => void;
  onMessage: () => void;
  onSend: () => void;
}): React.ReactElement {
  return (
    <ProfileCover
      insetTop={insetTop}
      avatar={
        <Avatar
          address={addr}
          size={PROFILE_AVATAR_SIZE}
          style={{ backgroundColor: c.border, borderWidth: 3, borderColor: c.bg }}
          onPress={onAvatar}
        />
      }
    >
      <Column padding={{ x: PAGE_GUTTER, bottom: 8 }} align="start">
        <Column margin={{ top: 14 }} style={{ alignSelf: 'stretch' }}>
          <Column gap={6} align="start">
            <Text text={displayName} fontWeight="semibold" size="2xl" textAlign="start" />
            {handle && displayHandle(handle) !== displayName ? <Text text={displayHandle(handle)} size="xs" color={c.text} /> : null}
            {about ? <Text text={about} size="xl" textAlign="start" /> : null}
          </Column>
        </Column>
        <Column margin={{ top: 2 }}>
          <GesturePressable
            hitSlop={8}
            onPress={() => {
              capabilities.copy('Address', addr);
            }}
          >
            <Text text={shortAddress(addr)} size="xs" color={c.text} />
          </GesturePressable>
        </Column>
        {isSelf ? null : <ProfileActions dark={dark} c={c} onMessage={onMessage} onSend={onSend} />}
      </Column>
    </ProfileCover>
  );
}

export function ProfileScreen({ address: addr }: { address: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const c = usePalette();

  const isSelf = addr.toLowerCase() === useSelfAddress().toLowerCase();

  usePeerProfiles([addr]);

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const onMessage = (): void => {
    router.replace(dmLinkOf(addr));
  };

  const onSend = (): void => {
    router.push({ pathname: '/wallet/send', params: { to: addr } });
  };
  const menuActions: MenuActions<PeerProfileId> = {
    message: onMessage,
    send: onSend,
    'copy-address': () => {
      capabilities.copy('Address', addr);
    },
  };

  const displayName = profileDisplayName(addr, getPeerName(addr), shortAddress(addr));

  return (
    <Column weight={1} surface="surface">
      <ProfileCoverBar insetTop={insets.top} trailing={<ProfileMenu isSelf={isSelf} actions={menuActions} />} />

      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileIdentity
          addr={addr}
          isSelf={isSelf}
          dark={dark}
          c={c}
          insetTop={insets.top}
          displayName={displayName}
          handle={getPeerHandle(addr)}
          about={getPeerDescription(addr)}
          onAvatar={(uri) => {
            if (uri) setViewerUri(uri);
          }}
          onMessage={onMessage}
          onSend={onSend}
        />

        {isSelf ? null : <CommonChannels peerAddress={addr} c={c} />}
      </ScreenScroll>

      <ImageViewer
        uri={viewerUri ?? ''}
        visible={viewerUri !== null}
        onClose={() => {
          setViewerUri(null);
        }}
      />
    </Column>
  );
}
