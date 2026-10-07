import { useEffect, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { errorLine } from '@stage-labs/client/errors';
import { Avatar } from '../Avatar';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { PictureEditor, type PictureChoice } from '../PictureEditor';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { getPeerAvatar, getPeerDescription, getPeerDisplayName, invalidatePeerProfile } from '../../lib/peerProfiles';
import { saveBasenameProfile, type ProfileChanges } from '../../lib/profile';
import { changedFields, draftFrom, draftProblem, hasChanges, type ProfileDraft } from './ProfileSettings.edit.model';

function pictureChanges(picture: PictureChoice): Pick<ProfileChanges, 'image' | 'removeImage'> {
  if (picture.kind === 'new') return { image: picture.file };
  if (picture.kind === 'remove') return { removeImage: true };
  return {};
}

function EditProfileSection({ address, name, picture, onSaved }: {
  address: string; name: string; picture: PictureChoice; onSaved: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const current = { displayName: getPeerDisplayName(address), description: getPeerDescription(address) };
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(current));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setDraft(draftFrom(current)); }, [current.displayName, current.description]);

  const problem = draftProblem(draft);
  const dirty = hasChanges(current, draft, picture.kind !== 'keep');

  const save = (): void => {
    if (busy || problem) return;
    if (!dirty) { setStatus('Nothing changed yet.'); return; }
    setBusy(true);
    setStatus('Uploading and sending the transaction…');
    void saveBasenameProfile(address, name, { ...changedFields(current, draft), ...pictureChanges(picture) })
      .then((hash) => {
        onSaved();
        setStatus(hash ? `Saved onchain (${hash.slice(0, 10)}…). It can take a minute to appear everywhere.` : 'Nothing to save.');
        capabilities.toast('Profile saved.');
      })
      .catch((err: unknown) => { setStatus(`Could not save: ${errorLine(err)}`); })
      .finally(() => { setBusy(false); });
  };

  return (
    <Col gap={8}>
      <Col gap={8}>
        <FormField label="Display name" placeholder="How people see you" value={draft.displayName} onChangeText={(v) => { setDraft({ ...draft, displayName: v }); }} disabled={busy} />
        <FormField label="About" placeholder="A few words about you" multiline value={draft.description} onChangeText={(v) => { setDraft({ ...draft, description: v }); }} disabled={busy} />
      </Col>
      {problem ?? status ? <Text value={problem ?? status ?? ''} size="xs" color="secondary" /> : null}
      <Box padding={{ top: 8 }}>
        <Button label={busy ? 'Saving…' : 'Save'} block size="lg" color="primary" variant="solid" dark={dark}
          disabled={busy || problem !== null} onPress={save} />
      </Box>
    </Col>
  );
}

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
