import { useEffect, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { AvatarView } from '@stage-labs/kit/react-native/avatar-view';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import type { GroupEditRights, GroupMetaPatch } from '@stage-labs/client/xmtp/groups';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { PictureEditor, type PictureChoice } from '../PictureEditor';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { uploadAvatar } from '../../lib/profile';
import { addLabel, removeLabel } from '@stage-labs/client/xmtp/labels';
import {
  addGroupLabel, getGroupLabels, invalidateConvMeta, lineOfConv, removeGroupLabel, updateGroupMeta,
} from '../../modules/messaging';
import { reported } from '../../lib/errorPolicy';
import { useConvMetaPatch } from './group.detail';
import { GroupLabelsEditor } from './group.labels';
import {
  groupChanges, groupDraftFrom, groupDraftProblem, groupMetaCachePatch, hasLabelEdits, labelEdits,
  type GroupCurrent, type GroupDraft, type LabelEdits,
} from './EditGroupModal.model';

const AVATAR_PX = 96;

function groupAvatarSrc(convId: string, imageUrl: string, picture: PictureChoice): string {
  if (picture.kind === 'new') return picture.file.uri;
  if (picture.kind === 'keep' && imageUrl.trim()) return avatarRenderUrl('', imageUrl, AVATAR_PX * 2);
  return stampAvatarUrl(channelStampSeed(convId), AVATAR_PX);
}

async function writeGroup(convId: string, patch: GroupMetaPatch, picture: PictureChoice): Promise<GroupMetaPatch> {
  const full = { ...patch };
  if (picture.kind === 'new') full.imageUrl = await uploadAvatar(picture.file.uri, picture.file.mime, picture.file.name ?? 'group-avatar');
  if (picture.kind === 'remove') full.imageUrl = '';
  if (Object.keys(full).length > 0) await updateGroupMeta(convId, full);
  return full;
}

async function writeLabels(line: string, edits: LabelEdits): Promise<string[] | null> {
  let latest: string[] | null = null;
  for (const label of edits.removed) latest = await removeGroupLabel(line, label);
  for (const label of edits.added) latest = await addGroupLabel(line, label);
  return latest;
}

function useLabelDraft(labels: string[]): {
  draft: string[]; input: string; setInput: (s: string) => void;
  add: (label: string) => void; remove: (label: string) => void; final: () => string[];
} {
  const [draft, setDraft] = useState<string[]>(labels);
  const [input, setInput] = useState('');
  useEffect(() => { setDraft(labels); }, [labels]);
  const add = (label: string): void => {
    if (!label.trim()) return;
    setDraft((d) => addLabel(d, label));
    setInput('');
  };
  const remove = (label: string): void => { setDraft((d) => removeLabel(d, label)); };
  const final = (): string[] => (input.trim() ? addLabel(draft, input) : draft);
  return { draft, input, setInput, add, remove, final };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message.split('\n')[0] ?? 'unknown error' : String(err);
}

async function saveGroup(convId: string, patch: GroupMetaPatch, picture: PictureChoice, edits: LabelEdits): Promise<{
  written: GroupMetaPatch; labels: string[] | null;
}> {
  const written = await writeGroup(convId, patch, picture);
  const labels = await writeLabels(lineOfConv(convId), edits);
  return { written, labels };
}

function EditGroupSection({ convId, current, rights, picture, labels, onLabelsSaved, onSaved }: {
  convId: string; current: GroupCurrent; rights: GroupEditRights; picture: PictureChoice;
  labels: string[]; onLabelsSaved: (labels: string[]) => void; onSaved: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const patchMeta = useConvMetaPatch(convId);
  const [draft, setDraft] = useState<GroupDraft>(() => groupDraftFrom(current));
  const labelDraft = useLabelDraft(labels);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setDraft(groupDraftFrom(current)); }, [current.name, current.description]);

  const problem = groupDraftProblem(current, draft);
  const changes = groupChanges(current, draft);

  const save = (): void => {
    if (busy || problem) return;
    const edits = labelEdits(labels, labelDraft.final());
    if (Object.keys(changes).length === 0 && picture.kind === 'keep' && !hasLabelEdits(edits)) { setStatus('Nothing changed yet.'); return; }
    setBusy(true);
    setStatus(null);
    void saveGroup(convId, changes, picture, edits)
      .then(({ written, labels: saved }) => {
        patchMeta(groupMetaCachePatch(written));
        if (saved) onLabelsSaved(saved);
        onSaved();
        capabilities.toast('Group saved.');
      })
      .catch((err: unknown) => {
        invalidateConvMeta(convId);
        void getGroupLabels(lineOfConv(convId)).then(onLabelsSaved).catch(reported('group.labels'));
        setStatus(`Could not save: ${errorText(err)}`);
      })
      .finally(() => { setBusy(false); });
  };

  return (
    <Col gap={8}>
      <Col gap={8}>
        <FormField label="Name" placeholder="Group name" value={draft.name} onChangeText={(v) => { setDraft({ ...draft, name: v }); }} disabled={busy || !rights.name} />
        <FormField label="Description" placeholder="What is this group about?" multiline value={draft.description} onChangeText={(v) => { setDraft({ ...draft, description: v }); }} disabled={busy || !rights.description} />
        <GroupLabelsEditor labels={labelDraft.draft} input={labelDraft.input} setInput={labelDraft.setInput} disabled={busy}
          onAdd={labelDraft.add} onRemove={labelDraft.remove} />
      </Col>
      {problem ?? status ? <Text value={problem ?? status ?? ''} size="md" color="secondary" /> : null}
      <Box padding={{ top: 8 }}>
        <Button label={busy ? 'Saving…' : 'Save'} block size="lg" color="primary" variant="solid" dark={dark}
          disabled={busy || problem !== null} onPress={save} />
      </Box>
    </Col>
  );
}

export function EditGroupModal({ visible, onClose, convId, name, description, imageUrl, rights, labels, onLabelsSaved }: {
  visible: boolean; onClose: () => void; convId: string;
  name: string | null; description: string; imageUrl: string; rights: GroupEditRights;
  labels: string[]; onLabelsSaved: (labels: string[]) => void;
}): React.ReactElement {
  const [picture, setPicture] = useState<PictureChoice>({ kind: 'keep' });
  const close = (): void => { setPicture({ kind: 'keep' }); onClose(); };
  const removable = picture.kind === 'new' || (picture.kind === 'keep' && imageUrl.trim() !== '');
  const avatar = <AvatarView src={groupAvatarSrc(convId, imageUrl, picture)} size={AVATAR_PX} square />;
  return (
    <AppModal visible={visible} onClose={close} title="Edit group">
      <Col align="center" padding={{ bottom: 16 }}>
        <PictureEditor avatar={avatar} editable={rights.image} removable={removable} onChange={setPicture} />
      </Col>
      <EditGroupSection convId={convId} current={{ name, description }} rights={rights} picture={picture}
        labels={labels} onLabelsSaved={onLabelsSaved} onSaved={close} />
    </AppModal>
  );
}
