
import { useEffect, useState } from 'react';

import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../../components/layout';
import { OverlayHeader } from '../../components/chrome/OverlayHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { cachedSelfEthAddress, selfEthAddress } from '../../modules/messaging';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ImageViewer } from '../../components/ImageViewer';
import { AddMemberModal, OverflowModal } from '../../components/group/group.parts';
import type { MenuPoint } from '../../components/AnchoredMenu.model';
import { GroupMembersList } from '../../components/group/group.members';
import { GroupProfileHeader, GroupTitle } from '../../components/group/group.header';
import { EditGroupModal } from '../../components/group/EditGroupModal';
import { useGroupDetail } from '../../components/group/group.detail';
import { GroupLabelsSection } from '../../components/group/group.labels';
import { profileLinkOf } from '../../lib/links';
import { reported } from '../../lib/errorPolicy';

function OverflowTrailing({ color, dark, onPress }: {
  color: string; dark: boolean; onPress: (point: MenuPoint) => void;
}): React.ReactElement {
  return (
    <GesturePressable onPress={onPress} hitSlop={10}>
      <Box padding={6}>
        <Icon name="dotsHorizontal" size={24} color={color} dark={dark} />
      </Box>
    </GesturePressable>
  );
}

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg } = usePalette();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const g = useGroupDetail(convId);
  const [addOpen, setAddOpen] = useState(false);
  const [selfAddress, setSelfAddress] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<MenuPoint | null>(null);

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
          <OverflowTrailing color={fg} dark={dark} onPress={(point) => { setOverflowAnchor(point); }} />
        }
      />
      <GroupProfileHeader
        insetTop={insets.top} imageUrl={g.imageUrl} channelId={convId ?? ''}
        onView={() => { setViewerOpen(true); }}
      />
      <GroupTitle name={g.name} description={g.description} />
      <GroupLabelsSection line={g.line}/>
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
      <OverflowModal
        visible={overflowAnchor !== null}
        anchor={overflowAnchor}
        onClose={() => { setOverflowAnchor(null); }}
        leaving={g.busy.leave === true} onLeave={() => { void g.leaveGroup(() => { setOverflowAnchor(null); }); }}
        onEdit={canEditGroup(g.rights) ? () => { setOverflowAnchor(null); setEditOpen(true); } : undefined}
      />
      <EditGroupModal
        visible={editOpen}
        onClose={() => { setEditOpen(false); }}
        convId={convId ?? ''} name={g.name} description={g.description} imageUrl={g.imageUrl} rights={g.rights}
      />
      <ImageViewer
        uri={g.imageUrl ? avatarRenderUrl('', g.imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
      />
    </Col>
  );
}
