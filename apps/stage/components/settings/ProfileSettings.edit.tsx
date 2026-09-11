import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Input } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Text } from '@stage-labs/kit/react-native/text';
import { fontSize } from '@stage-labs/kit/tokens';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { flash } from '../../lib/toast';
import { getPeerDescription, getPeerDisplayName } from '../../lib/peerProfiles';
import { saveBasenameProfile } from '../../lib/profileWrite';
import { GroupImagePicker } from '../GroupImagePicker';
import { SettingsButtonRow, SettingsList } from './rows';
import { changedFields, draftFrom, draftProblem, hasChanges, type ProfileDraft } from './ProfileSettings.edit.model';

function fieldStyle(fg: string, border: string): { color: string; borderColor: string; borderWidth: number; borderRadius: number; paddingHorizontal: number; paddingVertical: number; fontFamily: string; fontSize: number } {
  return { color: fg, borderColor: border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg') };
}

export function EditProfileSection({ address, name, onSaved, onImagePicked }: {
  address: string; name: string; onSaved: () => void; onImagePicked: (uri: string | null) => void;
}): React.ReactElement {
  const { text: fg, sub, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const current = { displayName: getPeerDisplayName(address), description: getPeerDescription(address) };
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(current));
  const [image, setImage] = useState<PickedFile | null>(null);
  const [pickNonce, setPickNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setDraft(draftFrom(current)); }, [current.displayName, current.description]);

  const problem = draftProblem(draft);
  const dirty = hasChanges(current, draft, image !== null);

  const save = (): void => {
    if (busy || problem) return;
    if (!dirty) { setStatus('Nothing changed yet.'); return; }
    setBusy(true);
    setStatus('Uploading and sending the transaction…');
    void saveBasenameProfile(address, name, { ...changedFields(current, draft), image: image ?? undefined })
      .then((hash) => {
        setImage(null); onImagePicked(null); onSaved();
        setStatus(hash ? `Saved onchain (${hash.slice(0, 10)}…). It can take a minute to appear everywhere.` : 'Nothing to save.');
        flash('Profile saved.');
      })
      .catch((err: unknown) => { setStatus(`Could not save: ${err instanceof Error ? err.message.split('\n')[0] ?? 'unknown error' : String(err)}`); })
      .finally(() => { setBusy(false); });
  };

  return (
    <Col gap={8}>
      <Caption color={fg} style={{ paddingHorizontal: 16 }}>EDIT PROFILE</Caption>
      <Box padding={{ x: 16 }}>
        <Input value={draft.displayName} onChangeText={(v) => { setDraft({ ...draft, displayName: v }); }} placeholder="Display name" placeholderTextColor={sub} dark={dark} disabled={busy} inputType="text" style={fieldStyle(fg, border)} />
      </Box>
      <Box padding={{ x: 16 }}>
        <Textarea value={draft.description} onChangeText={(v) => { setDraft({ ...draft, description: v }); }} placeholder="About you" placeholderTextColor={sub} dark={dark} disabled={busy} rows={3} style={fieldStyle(fg, border)} />
      </Box>
      {problem ?? status ? <Box padding={{ x: 16 }}><Text value={problem ?? status ?? ''} size="md" color="secondary" /></Box> : null}
      <SettingsList>
        <SettingsButtonRow
          label={image ? 'Picture selected, save to apply' : 'Change picture'}
          onPress={() => { if (!busy) setPickNonce(n => n + 1); }}
        />
        <SettingsButtonRow
          label={busy ? 'Saving…' : 'Save changes'}
          description="Writes the standard ENS name, description and avatar records to your name on Base. Stage pays the fee."
          onPress={save}
        />
      </SettingsList>
      <GroupImagePicker openNonce={pickNonce} onPick={(file) => { setImage(file); onImagePicked(file.uri); }} />
    </Col>
  );
}
