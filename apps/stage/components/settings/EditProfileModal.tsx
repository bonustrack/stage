import { useState } from 'react';
import { Avatar } from '../Avatar';
import { AppModal } from '../AppModal';
import { PictureEditor, type PictureChoice } from '../PictureEditor';
import { Col } from '../layout';
import { EditProfileSection } from './ProfileSettings.edit';
import { getPeerAvatar, invalidatePeerProfile } from '../../lib/peerProfiles';

function profileAvatar(address: string, picture: PictureChoice): React.ReactElement {
  if (picture.kind === 'new') return <Avatar imageUri={picture.file.uri} size={96} />;
  return <Avatar address={picture.kind === 'remove' ? null : address} size={96} />;
}

export function EditProfileModal({ visible, onClose, address, handle }: {
  visible: boolean; onClose: () => void; address: string; handle: string;
}): React.ReactElement {
  const [picture, setPicture] = useState<PictureChoice>({ kind: 'keep' });
  const close = (): void => { setPicture({ kind: 'keep' }); onClose(); };
  const removable = picture.kind === 'new' || (picture.kind === 'keep' && getPeerAvatar(address) !== undefined);
  return (
    <AppModal visible={visible} onClose={close} title="Edit profile">
      <Col align="center" padding={{ bottom: 16 }}>
        <PictureEditor avatar={profileAvatar(address, picture)} editable removable={removable} onChange={setPicture} />
      </Col>
      <EditProfileSection address={address} name={handle} picture={picture}
        onSaved={() => { invalidatePeerProfile(address); close(); }} />
    </AppModal>
  );
}
