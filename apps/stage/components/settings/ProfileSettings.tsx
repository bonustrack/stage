import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';

import { capabilities } from '../../lib/capabilities';
import { getPeerAvatar, getPeerHandle, getPeerName, getPeerProfileSource, invalidatePeerProfile, usePeerProfiles } from '../../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { Avatar } from '../Avatar';
import { SettingsPage } from './SettingsPage';
import { profileView, type ProfileView } from './ProfileSettings.model';
import { ClaimStageName } from './ProfileSettings.claim';
import { EditProfileSection, type ProfilePicture } from './ProfileSettings.edit';
import { GroupImagePicker } from '../GroupImagePicker';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
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
    capabilities.copy('Address', address);
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
  const removable = picture.kind === 'new' || (picture.kind === 'keep' && getPeerAvatar(address) !== undefined);
  if (!editable) return avatar;
  return (
    <>
      <Pressable onPress={(e) => { setAnchor(menuPointBelow(e)); setOpen(true); }} hitSlop={8}>{avatar}</Pressable>
      <AnchoredMenu visible={open} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          <MenuRow icon="camera" label="Upload a picture" dark={dark} onPress={() => { close(); onPick(); }} />
          {removable ? <MenuRow icon="trash" label="Remove picture" danger dark={dark} onPress={() => { close(); onRemove(); }} /> : null}
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
      {handle && displayHandle(handle) !== name ? <Caption value={displayHandle(handle)} color="secondary" /> : null}
      {address ? <CopyableAddress address={address} /> : null}
    </Col>
  );
}

function ClaimPane({ address }: { address: string }): React.ReactElement {
  return (
    <Col align="center" padding={{ top: 24, bottom: 16 }}>
      <ClaimStageName address={address} onClaimed={() => { invalidatePeerProfile(address); }} />
    </Col>
  );
}

function EditPane({ address, handle, view, picture, pickNonce, onPick, onRemove, onFile, onSaved }: {
  address: string | null; handle: string | undefined; view: ProfileView; picture: ProfilePicture; pickNonce: number;
  onPick: () => void; onRemove: () => void; onFile: (file: PickedFile) => void; onSaved: () => void;
}): React.ReactElement {
  const name = getPeerName(address);
  return (
    <>
      <ProfileHeader address={address} name={name} handle={handle}>
        <ProfilePicture address={address} picture={picture} editable={handle !== undefined && view.canChangePicture}
          onPick={onPick} onRemove={onRemove} />
      </ProfileHeader>
      <GroupImagePicker openNonce={pickNonce} onPick={onFile} />
      {view.explanation === '' ? null : (
        <Box padding={{ x: 16, bottom: 12 }}>
          <Text value={view.explanation} size="md" color="secondary" />
        </Box>
      )}
      {address && handle && view.canChangePicture ? (
        <Box padding={{ bottom: 16 }}>
          <EditProfileSection address={address} name={handle} picture={picture} onSaved={onSaved} />
        </Box>
      ) : null}
    </>
  );
}

export function ProfileSettings(): React.ReactElement {

  const address = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([address]);
  const handle = getPeerHandle(address);
  const source = getPeerProfileSource(address);
  const view = profileView({ address, name: handle, source });
  const [picture, setPicture] = useState<ProfilePicture>({ kind: 'keep' });
  const [pickNonce, setPickNonce] = useState(0);
  const onSaved = (): void => { setPicture({ kind: 'keep' }); if (address) invalidatePeerProfile(address); };

  return (
    <SettingsPage title="Profile">
      {address && view.claimVisible ? <ClaimPane address={address} /> : (
        <EditPane address={address} handle={handle} view={view} picture={picture} pickNonce={pickNonce}
          onPick={() => { setPickNonce(n => n + 1); }} onRemove={() => { setPicture({ kind: 'remove' }); }}
          onFile={(file) => { setPicture({ kind: 'new', file }); }} onSaved={onSaved} />
      )}
    </SettingsPage>
  );
}
