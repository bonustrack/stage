
import { useEffect, useState } from 'react';

import { capabilities } from '../../lib/capabilities';
import { Col } from '../../components/layout';
import { OverlayHeader } from '../../components/chrome/OverlayHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { cachedSelfEthAddress, selfEthAddress } from '../../modules/messaging';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ImageViewer } from '../../components/ImageViewer';
import { AddMemberModal } from '../../components/group/group.parts';
import { groupMenuItems } from '../../components/group/group.parts.model';
import { RoundOverflowMenu } from '../../components/MenuRows';
import { GroupMembersList } from '../../components/group/group.members';
import { GroupProfileHeader, GroupTitle } from '../../components/group/group.header';
import { EditGroupModal } from '../../components/group/EditGroupModal';
import { useGroupDetail } from '../../components/group/group.detail';
import { GroupLabelsView, useGroupLabels } from '../../components/group/group.labels';
import { profileLinkOf } from '../../lib/links';
import { reported } from '../../lib/errorPolicy';

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg } = usePalette();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const g = useGroupDetail(convId);
  const [labels, setLabels] = useGroupLabels(g.line);
  const [addOpen, setAddOpen] = useState(false);
  const [selfAddress, setSelfAddress] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const cached = cachedSelfEthAddress();
    if (cached) { setSelfAddress(cached.toLowerCase()); return; }
    void selfEthAddress().then(addr => {
      if (addr) setSelfAddress(addr.toLowerCase());
    }).catch(reported('group.selfAddress'));
  }, []);

  return (
    <Col surface="surface" flex={1}>
      <OverlayHeader
        onBack={() => { capabilities.back(); }}
        backColor={fg}
        safeTop={insets.top}
        trailing={
          <RoundOverflowMenu
            items={groupMenuItems(canEditGroup(g.rights))} loading={g.busy.leave === true}
            onSelect={(id) => { if (id === 'edit') setEditOpen(true); else void g.leaveGroup(); }}
          />
        }
      />
      <GroupProfileHeader
        insetTop={insets.top} imageUrl={g.imageUrl} channelId={convId ?? ''}
        onView={() => { setViewerOpen(true); }}
      />
      <GroupTitle name={g.name} description={g.description} />
      <GroupLabelsView labels={labels} />
      <GroupMembersList
        members={g.members} memberNames={g.memberNames} memberRoles={g.memberRoles}
        selfAddress={selfAddress} removing={g.removing} dark={dark}
        onAdd={() => { g.setAddDraft(''); setAddOpen(true); }}
        onOpenMember={(item) => { router.push(profileLinkOf(item)); }}
        onRemoveMember={(item) => { void g.removeMember(item); }}
      />
      <AddMemberModal
        visible={addOpen}
        onClose={() => { setAddOpen(false); }}
        addDraft={g.addDraft} setAddDraft={g.setAddDraft} adding={g.busy.add === true}
        onAdd={() => { void g.addMember(() => { setAddOpen(false); }); }}
        dark={dark}
      />
      <EditGroupModal
        visible={editOpen}
        onClose={() => { setEditOpen(false); }}
        convId={convId ?? ''} name={g.name} description={g.description} imageUrl={g.imageUrl} rights={g.rights}
        labels={labels} onLabelsSaved={setLabels}
      />
      <ImageViewer
        uri={g.imageUrl ? avatarRenderUrl('', g.imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
      />
    </Col>
  );
}
