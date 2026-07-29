
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../../components/layout';
import { GroupImagePicker } from '../../components/GroupImagePicker';
import { OverlayHeader } from '../../components/chrome/OverlayHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cachedSelfEthAddress, selfEthAddress, lineOfConv } from '../../modules/messaging';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ImageViewer } from '../../components/ImageViewer';
import { AddMemberModal, OverflowModal } from './group.parts';
import type { MenuPoint } from '../../components/AnchoredMenu.model';
import { GroupMembersList } from './group.members';
import { GroupProfileHeader, GroupNameEditor, GroupDescriptionEditor } from './group.editor';
import { messagingKeys } from '../../modules/messaging';
import { useGroupDetail } from './group.detail';
import { GroupLabelsSection } from './group.labels';
import { useGroupActions } from './group.actions';

function OverflowTrailing({ color, dark, onPress }: {
  color: string; dark: boolean; onPress: (point: MenuPoint) => void;
}): React.ReactElement {
  return (
    <GesturePressable onPress={onPress} hitSlop={10}>
      <Box padding={6}>
        <Icon name="dotsHorizontal" size={22} color={color} dark={dark} />
      </Box>
    </GesturePressable>
  );
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
  const [overflowAnchor, setOverflowAnchor] = useState<MenuPoint | null>(null);

  useEffect(() => {
    const cached = cachedSelfEthAddress();
    if (cached) { setSelfAddress(cached.toLowerCase()); return; }
    void selfEthAddress().then(addr => {
      if (addr) setSelfAddress(addr.toLowerCase());
    }).catch(() => undefined);
  }, []);

  return (
    <Col surface="surface" flex={1}>
      <OverlayHeader
        onBack={() => { capabilities.back(); }}
        backColor={fg}
        safeTop={insets.top}
        trailing={
          <OverflowTrailing color={fg} dark={dark} onPress={(point) => { setOverflowAnchor(point); }} />
        }
      />

      <GroupProfileHeader
        insetTop={insets.top} imageUrl={imageUrl} channelId={convId ?? ''} uploadingImage={uploadingImage}
        fg={fg} bg={bg} rowBg={rowBg}
        onTap={() => { if (imageUrl) setViewerOpen(true); else pickImage(); }}
        onPick={() => { pickImage(); }}
/>
      <GroupImagePicker openNonce={pickNonce} onPick={(file) => { void onPickedImage(file); }} />

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
      <GroupMembersList
        members={members} memberNames={memberNames} memberRoles={memberRoles}
        selfAddress={selfAddress} removing={removing} dark={dark} p={pal}
        onAdd={() => { setAddDraft(''); setAddOpen(true); }}
        onOpenMember={(item) => { router.push({ pathname: '/profile/[address]', params: { address: item } }); }}
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
        visible={overflowAnchor !== null}
        anchor={overflowAnchor}
        onClose={() => { setOverflowAnchor(null); }}
        leaving={leaving} onLeave={() => { leaveGroup(() => { setOverflowAnchor(null); }); }}
/>
      <ImageViewer
        uri={imageUrl ? avatarRenderUrl('', imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
/>
    </Col>
  );
}
