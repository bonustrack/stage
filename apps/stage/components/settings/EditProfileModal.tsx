import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Avatar } from '../Avatar';
import { AppModal } from '../AppModal';
import { AnchoredMenu, menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuList, MenuRow } from '../MenuRows';
import { GroupImagePicker } from '../GroupImagePicker';
import { Col } from '../layout';
import { EditProfileSection, type ProfilePicture } from './ProfileSettings.edit';
import { getPeerAvatar, invalidatePeerProfile } from '../../lib/peerProfiles';
import { useEffectiveColorScheme } from '../../lib/theme';

function ProfilePictureEditor({ address, picture, editable, onPick, onRemove }: {
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

export function EditProfileModal({ visible, onClose, address, handle }: {
  visible: boolean; onClose: () => void; address: string; handle: string;
}): React.ReactElement {
  const [picture, setPicture] = useState<ProfilePicture>({ kind: 'keep' });
  const [pickNonce, setPickNonce] = useState(0);
  const close = (): void => { setPicture({ kind: 'keep' }); onClose(); };
  return (
    <AppModal visible={visible} onClose={close} title="Edit profile">
      <Col align="center" padding={{ bottom: 16 }}>
        <ProfilePictureEditor address={address} picture={picture} editable
          onPick={() => { setPickNonce(n => n + 1); }} onRemove={() => { setPicture({ kind: 'remove' }); }} />
      </Col>
      <GroupImagePicker openNonce={pickNonce} onPick={(file) => { setPicture({ kind: 'new', file }); }} />
      <EditProfileSection address={address} name={handle} picture={picture}
        onSaved={() => { invalidatePeerProfile(address); close(); }} />
    </AppModal>
  );
}
