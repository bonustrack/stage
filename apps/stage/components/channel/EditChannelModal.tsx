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
import { invalidateConvMeta } from '../../modules/messaging/queries';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { updateGroupMeta } from '../../modules/messaging/groupRow';
import { useConvMetaPatch } from './channel.detail';
import { ChannelLabelsEditor, writeLabels } from './channel.labels';
import {
  channelChanges, channelDraftFrom, channelDraftProblem, channelMetaCachePatch, type ChannelCurrent, type ChannelDraft,
} from './EditChannelModal.model';
import { hasListEdits, listEdits, type ListEdits } from '../conversation/SidebarSection.model';

const AVATAR_PX = 96;

function channelAvatarSrc(convId: string, imageUrl: string, picture: PictureChoice): string {
  if (picture.kind === 'new') return picture.file.uri;
  if (picture.kind === 'keep' && imageUrl.trim()) return avatarRenderUrl(imageUrl);
  return stampAvatarUrl(channelStampSeed(convId), AVATAR_PX);
}

async function writeChannel(convId: string, patch: GroupMetaPatch, picture: PictureChoice): Promise<GroupMetaPatch> {
  const full = { ...patch };
  if (picture.kind === 'new') full.imageUrl = await uploadAvatar(picture.file.uri, picture.file.mime, picture.file.name ?? 'channel-avatar');
  if (picture.kind === 'remove') full.imageUrl = '';
  if (Object.keys(full).length > 0) await updateGroupMeta(convId, full);
  return full;
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

async function saveChannel(convId: string, patch: GroupMetaPatch, picture: PictureChoice, edits: ListEdits): Promise<GroupMetaPatch> {
  const written = await writeChannel(convId, patch, picture);
  await writeLabels(lineOfConv(convId), edits);
  return written;
}

function EditChannelSection({ convId, current, rights, picture, labels, onSaved }: {
  convId: string; current: ChannelCurrent; rights: GroupEditRights; picture: PictureChoice;
  labels: string[]; onSaved: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const patchMeta = useConvMetaPatch(convId);
  const [draft, setDraft] = useState<ChannelDraft>(() => channelDraftFrom(current));
  const labelDraft = useLabelDraft(labels);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setDraft(channelDraftFrom(current)); }, [current.name, current.description]);

  const problem = channelDraftProblem(current, draft);
  const changes = channelChanges(current, draft);

  const save = (): void => {
    if (busy || problem) return;
    const edits = listEdits(labels, labelDraft.final());
    if (Object.keys(changes).length === 0 && picture.kind === 'keep' && !hasListEdits(edits)) { setStatus('Nothing changed yet.'); return; }
    setBusy(true);
    setStatus(null);
    void saveChannel(convId, changes, picture, edits)
      .then((written) => {
        patchMeta(channelMetaCachePatch(written));
        onSaved();
        capabilities.toast('Channel saved.');
      })
      .catch((err: unknown) => {
        invalidateConvMeta(convId);
        setStatus(`Could not save: ${errorText(err)}`);
      })
      .finally(() => { setBusy(false); });
  };

  return (
    <Col gap={8}>
      <Col gap={8}>
        <FormField label="Name" placeholder="Channel name" value={draft.name} onChangeText={(v) => { setDraft({ ...draft, name: v }); }} disabled={busy || !rights.name} />
        <FormField label="Description" placeholder="What is this channel about?" multiline value={draft.description} onChangeText={(v) => { setDraft({ ...draft, description: v }); }} disabled={busy || !rights.description} />
        <ChannelLabelsEditor labels={labelDraft.draft} input={labelDraft.input} setInput={labelDraft.setInput} disabled={busy}
          onAdd={labelDraft.add} onRemove={labelDraft.remove} />
      </Col>
      {problem ?? status ? <Text value={problem ?? status ?? ''} size="2xs" color="secondary" /> : null}
      <Box padding={{ top: 8 }}>
        <Button label={busy ? 'Saving…' : 'Save'} block size="lg" color="primary" variant="solid" dark={dark}
          disabled={busy || problem !== null} onPress={save} />
      </Box>
    </Col>
  );
}

export function EditChannelModal({ visible, onClose, convId, name, description, imageUrl, rights, labels }: {
  visible: boolean; onClose: () => void; convId: string;
  name: string | null; description: string; imageUrl: string; rights: GroupEditRights;
  labels: string[];
}): React.ReactElement {
  const [picture, setPicture] = useState<PictureChoice>({ kind: 'keep' });
  const close = (): void => { setPicture({ kind: 'keep' }); onClose(); };
  const removable = picture.kind === 'new' || (picture.kind === 'keep' && imageUrl.trim() !== '');
  const avatar = <AvatarView src={channelAvatarSrc(convId, imageUrl, picture)} size={AVATAR_PX} square />;
  return (
    <AppModal visible={visible} onClose={close} title="Edit channel">
      <Col align="center" padding={{ bottom: 16 }}>
        <PictureEditor avatar={avatar} editable={rights.image} removable={removable} onChange={setPicture} />
      </Col>
      <EditChannelSection convId={convId} current={{ name, description }} rights={rights} picture={picture}
        labels={labels} onSaved={close} />
    </AppModal>
  );
}
