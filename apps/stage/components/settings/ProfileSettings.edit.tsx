import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { Box, Col } from '../layout';
import { FormField } from '../FormField';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { getPeerDescription, getPeerDisplayName } from '../../lib/peerProfiles';
import { saveBasenameProfile, type ProfileChanges } from '../../lib/profileWrite';
import { changedFields, draftFrom, draftProblem, hasChanges, type ProfileDraft } from './ProfileSettings.edit.model';

export type ProfilePicture = { kind: 'keep' } | { kind: 'new'; file: PickedFile } | { kind: 'remove' };

function pictureChanges(picture: ProfilePicture): Pick<ProfileChanges, 'image' | 'removeImage'> {
  if (picture.kind === 'new') return { image: picture.file };
  if (picture.kind === 'remove') return { removeImage: true };
  return {};
}

export function EditProfileSection({ address, name, picture, onSaved }: {
  address: string; name: string; picture: ProfilePicture; onSaved: () => void;
}): React.ReactElement {
  const { text: fg } = usePalette();
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
      .catch((err: unknown) => { setStatus(`Could not save: ${err instanceof Error ? err.message.split('\n')[0] ?? 'unknown error' : String(err)}`); })
      .finally(() => { setBusy(false); });
  };

  return (
    <Col gap={8}>
      <Caption color={fg} style={{ paddingHorizontal: 16 }}>EDIT PROFILE</Caption>
      <Col padding={{ x: 16 }} gap={8}>
        <FormField label="Display name" placeholder="How people see you" value={draft.displayName} onChangeText={(v) => { setDraft({ ...draft, displayName: v }); }} disabled={busy} />
        <FormField label="About" placeholder="A few words about you" multiline value={draft.description} onChangeText={(v) => { setDraft({ ...draft, description: v }); }} disabled={busy} />
      </Col>
      {problem ?? status ? <Box padding={{ x: 16 }}><Text value={problem ?? status ?? ''} size="md" color="secondary" /></Box> : null}
      <Box padding={{ x: 16, top: 8 }}>
        <Button label={busy ? 'Saving…' : 'Save'} block size="lg" color="primary" variant="solid" dark={dark}
          disabled={busy || problem !== null} onPress={save} />
      </Box>
    </Col>
  );
}
