import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Col, ScreenScroll } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';

import { capabilities } from '../../lib/capabilities';
import { getPeerHandle, getPeerName, getPeerProfileSource, invalidatePeerProfile, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { Avatar } from '../Avatar';
import { StackHeader } from '../chrome/StackHeader';
import { profileView, type ProfileView } from './ProfileSettings.model';
import { ClaimStageName } from './ProfileSettings.claim';
import { EditProfileSection, type ProfilePicture } from './ProfileSettings.edit';
import { GroupImagePicker } from '../GroupImagePicker';
import { AnchoredMenu, menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuList, MenuRow } from '../MenuRows';

const COPIED_MS = 1500;

function CopyableAddress({ address }: { address: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => { setCopied(false); }, COPIED_MS);
    return () => { clearTimeout(timer); };
  }, [copied]);
  const copy = (): void => {
    void capabilities.copyToClipboard(address);
    capabilities.toast('Address copied');
    setCopied(true);
  };
  return (
    <Pressable onPress={copy} hitSlop={8}>
      <Text value={copied ? 'Copied' : shortAddress(address)} size="md" color="secondary" />
    </Pressable>
  );
}

function ProfilePicture({ address, picture, editable, onPick, onRemove }: {
  address: string | null; picture: ProfilePicture; editable: boolean; onPick: () => void; onRemove: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [open, setOpen] = useState(false);
  const close = (): void => { setOpen(false); };
  const avatar = picture.kind === 'new'
    ? <Avatar imageUri={picture.file.uri} size={96} />
    : <Avatar address={picture.kind === 'remove' ? null : address} size={96} />;
  if (!editable) return avatar;
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); setOpen(true); }} hitSlop={8}>{avatar}</Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          <MenuRow icon="camera" label="Upload a picture" dark={dark} onPress={() => { close(); onPick(); }} />
          <MenuRow icon="trash" label="Remove picture" danger dark={dark} onPress={() => { close(); onRemove(); }} />
        </MenuList>
      </AnchoredMenu>
    </>
  );
}

function ProfileHeader({ address, name, handle, children }: {
  address: string | null; name: string | undefined; handle: string | undefined; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Col align="center" gap={12} padding={{ y: 24 }}>
      {children}
      <Text value={name ?? (address ? shortAddress(address) : '')} size="2xl" weight="semibold" />
      {handle && handle !== name ? <Caption value={handle} color="secondary" /> : null}
      {address ? <CopyableAddress address={address} /> : null}
    </Col>
  );
}

function ProfileSections({ address, handle, view, picture, onSaved }: {
  address: string; handle: string | undefined; view: ProfileView; picture: ProfilePicture; onSaved: () => void;
}): React.ReactElement {
  return (
    <>
      {view.claimVisible ? (
        <Box padding={{ bottom: 16 }}>
          <ClaimStageName address={address} onClaimed={() => { invalidatePeerProfile(address); }} />
        </Box>
      ) : null}
      {handle && view.canChangePicture ? (
        <Box padding={{ bottom: 16 }}>
          <EditProfileSection address={address} name={handle} picture={picture} onSaved={onSaved} />
        </Box>
      ) : null}
    </>
  );
}

export function ProfileSettings(): React.ReactElement {

  const insets = useSafeAreaInsets();
  const address = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([address]);
  const name = getPeerName(address);
  const handle = getPeerHandle(address);
  const source = getPeerProfileSource(address);
  const view = profileView({ address, name: handle, source });
  const [picture, setPicture] = useState<ProfilePicture>({ kind: 'keep' });
  const [pickNonce, setPickNonce] = useState(0);
  const onSaved = (): void => { setPicture({ kind: 'keep' }); if (address) invalidatePeerProfile(address); };

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Profile"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ProfileHeader address={address} name={name} handle={handle}>
          <ProfilePicture address={address} picture={picture} editable={handle !== undefined && view.canChangePicture}
            onPick={() => { setPickNonce(n => n + 1); }} onRemove={() => { setPicture({ kind: 'remove' }); }} />
        </ProfileHeader>
        <GroupImagePicker openNonce={pickNonce} onPick={(file) => { setPicture({ kind: 'new', file }); }} />
        {view.explanation === '' ? null : (
          <Box padding={{ x: 16, bottom: 12 }}>
            <Text value={view.explanation} size="md" color="secondary" />
          </Box>
        )}
        {address ? <ProfileSections address={address} handle={handle} view={view} picture={picture} onSaved={onSaved} /> : null}
      </ScreenScroll>
    </Col>
  );
}
