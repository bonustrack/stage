import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { Col } from '../layout';
import { ProfileCoverBar, ProfileCoverMenu } from '../ProfileCover';
import { ImageViewer } from '../ImageViewer';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { cachedSelfEthAddress, selfEthAddress } from '../../modules/messaging';
import { useEffectiveColorScheme } from '../../lib/theme';
import { profileLinkOf } from '../../lib/links';
import { reported } from '../../lib/errorPolicy';
import { channelProfileMenuItems } from './channel.parts.model';
import { ChannelMembersList } from './channel.members';
import { ChannelAssignees, ChannelMembersSection } from '../conversation/MemberListSidebar';
import { ChannelProfileHeader, ChannelTitle } from './channel.header';
import { EditChannelModal } from './EditChannelModal';
import { useChannelDetail } from './channel.detail';
import { ChannelLabels, useLiveChannelLabels } from './channel.labels';

export function ChannelProfile({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const g = useChannelDetail(convId);
  const labels = useLiveChannelLabels(convId);
  const [selfAddress, setSelfAddress] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const cached = cachedSelfEthAddress();
    if (cached) { setSelfAddress(cached.toLowerCase()); return; }
    void selfEthAddress().then(addr => {
      if (addr) setSelfAddress(addr.toLowerCase());
    }).catch(reported('channel.selfAddress'));
  }, []);

  return (
    <Col surface="surface" flex={1}>
      <ProfileCoverBar
        insetTop={insets.top}
        trailing={
          <ProfileCoverMenu
            items={channelProfileMenuItems(canEditGroup(g.rights))} loading={g.busy.leave === true}
            onSelect={(id) => { if (id === 'edit') setEditOpen(true); else void g.leaveChannel(); }}
          />
        }
      />
      <ChannelProfileHeader
        insetTop={insets.top} imageUrl={g.imageUrl} channelId={convId}
        onView={() => { setViewerOpen(true); }}
      >
        <ChannelTitle name={g.name} description={g.description} />
      </ChannelProfileHeader>
      <ChannelMembersSection convId={convId} count={g.members.length}/>
      <ChannelMembersList
        members={g.members} memberNames={g.memberNames} memberRoles={g.memberRoles}
        selfAddress={selfAddress} removing={g.removing} dark={dark}
        footer={<><ChannelAssignees convId={convId}/><ChannelLabels convId={convId} labels={labels}/></>}
        onOpenMember={(item) => { router.push(profileLinkOf(item)); }}
        onRemoveMember={(item) => { void g.removeMember(item); }}
      />
      <EditChannelModal
        visible={editOpen}
        onClose={() => { setEditOpen(false); }}
        convId={convId} name={g.name} description={g.description} imageUrl={g.imageUrl} rights={g.rights}
        labels={labels}
      />
      <ImageViewer
        uri={g.imageUrl ? avatarRenderUrl('', g.imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
      />
    </Col>
  );
}
