
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers, WidgetNode, WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import type { GroupPickedFile } from './group.actions.handlers';
import { Col } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv } from '../../modules/messaging';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ImageViewer } from '../../components/ImageViewer';
import { AddMemberModal, OverflowModal } from './group.parts';
import { GroupMembersList } from './group.members';
import { GroupProfileHeader, GroupNameEditor, GroupDescriptionEditor } from './group.editor';
import { messagingKeys } from '../../modules/messaging';
import { useGroupDetail } from './group.detail';
import { GroupLabelsSection } from './group.labels';
import { GroupGithubSection } from './group.github';
import { useGroupActions } from './group.actions';

const GROUP_OVERFLOW_PRESS = 'group_overflow_press';

function overflowTrailing(color: string): WidgetNode {
  return {
    type: 'Pressable',
    hitSlop: 10,
    onClickAction: { type: GROUP_OVERFLOW_PRESS },
    children: [
      {
        type: 'Box',
        padding: 6,
        children: [{ type: 'Icon', name: 'dotsHorizontal', size: 22, color }],
      },
    ],
  };
}

function groupImagePickerNode(openNonce: number): WidgetRoot {
  return basicRoot({
    type: 'FilePicker',
    openNonce,
    source: 'library',
    mediaTypes: ['images'],
    quality: 0.85,
    multiple: false,
    allowsEditing: true,
    aspect: [1, 1],
    onPickAction: { type: 'group_image_pick', handler: 'client' },
  });
}

function groupImagePickerActions(
  onPicked: (file: GroupPickedFile) => Promise<void>,
): PayloadHandlers {
  return {
    group_image_pick: (payload) => {
      const files = payload.files;
      const file = Array.isArray(files) ? files[0] as GroupPickedFile | undefined : undefined;
      if (file !== undefined) void onPicked(file);
    },
  };
}

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, inputBg } = usePalette();
  const sub = fg, rowBg = border;
  const pal = { fg, head, sub, border, rowBg, inputBg };

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const line = lineOfConv(convId ?? '');
  const queryClient = useQueryClient();
  const invalidateConvMeta = (): void => {
    if (convId) void queryClient.invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
  };

  const a = useGroupActions(line, invalidateConvMeta);
  const {
    name, draft, setDraft, editing, setEditing, saving, saveName,
    description, descriptionDraft, setDescriptionDraft,
    editingDescription, setEditingDescription, savingDescription, saveDescription,
    members, addDraft, setAddDraft, adding, addMember,
    removing, removeMember, imageUrl, uploadingImage,
    pickImage, pickNonce, onPickedImage,
    leaving, leaveGroup,
  } = a;

  const { memberNames, memberRoles } = useGroupDetail(convId, a);
  const [addOpen, setAddOpen] = useState(false);
  const [selfAddress, setSelfAddress] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    const c = getCachedXmtpClient();
    if (c) { setSelfAddress(c.publicIdentity.identifier.toLowerCase()); return; }
    void getOrCreateXmtpClient('production').then(client => {
      setSelfAddress(client.publicIdentity.identifier.toLowerCase());
    }).catch(() => undefined);
  }, []);

  const headerNode = basicRoot(screenHeader({
    variant: 'overlay',
    backColor: fg,
    backHitSlop: 10,
    backPadding: 6,
    safeTop: insets.top,
    trailing: [overflowTrailing(fg)],
  }));
  const headerActions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [GROUP_OVERFLOW_PRESS]: () => { setOverflowOpen(true); },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={headerActions} />

      <GroupProfileHeader
        insetTop={insets.top} imageUrl={imageUrl} channelId={convId ?? ''} uploadingImage={uploadingImage}
        fg={fg} bg={bg} rowBg={rowBg}
        onTap={() => { if (imageUrl) setViewerOpen(true); else pickImage(); }}
        onPick={() => { pickImage(); }}
/>
      <ViewHost node={groupImagePickerNode(pickNonce)} actions={groupImagePickerActions(onPickedImage)} />

      <GroupNameEditor
        name={name} draft={draft} setDraft={setDraft}
        editing={editing} setEditing={setEditing} saving={saving}
        onSave={() => { void saveName(); }} dark={dark} p={pal}
/>

      <GroupDescriptionEditor
        description={description} descriptionDraft={descriptionDraft} setDescriptionDraft={setDescriptionDraft}
        editing={editingDescription} setEditing={setEditingDescription} saving={savingDescription}
        onSave={() => { void saveDescription(); }} dark={dark} p={pal}
/>

      <GroupLabelsSection line={line} p={pal}/>
      <GroupGithubSection line={line} p={pal}/>
      <GroupMembersList
        members={members} memberNames={memberNames} memberRoles={memberRoles}
        selfAddress={selfAddress} removing={removing} dark={dark} p={pal}
        onAdd={() => { setAddDraft(''); setAddOpen(true); }}
        onOpenMember={(item) => { router.push({ pathname: '/user/[address]', params: { address: item } }); }}
        onRemoveMember={(item) => { removeMember(item); }}
/>

      <AddMemberModal
        visible={addOpen}
        onClose={() => { setAddOpen(false); }}
        addDraft={addDraft} setAddDraft={setAddDraft} adding={adding}
        onAdd={() => { void addMember(() => { setAddOpen(false); }); }}
        dark={dark} p={pal}
/>
      <OverflowModal
        visible={overflowOpen}
        onClose={() => { setOverflowOpen(false); }}
        leaving={leaving} onLeave={() => { leaveGroup(() => { setOverflowOpen(false); }); }}
/>
      <ImageViewer
        uri={imageUrl ? avatarRenderUrl('', imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
/>
    </Col>
  );
}
