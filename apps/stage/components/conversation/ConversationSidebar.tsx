import { MemberListSidebar } from '../channel/MemberListSidebar';
import { TOPNAV_HEIGHT } from '../Topnav';
import { createPaneWidth } from '../layout/paneWidth';
import { rightPaneRule } from '../layout/webChrome';
import { PaneResizeHandle } from '../layout/PaneResizeHandle';
import { useSafeAreaInsets } from '../layout/safeArea';
import { usePalette } from '../../lib/theme';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { PROFILE_AVATAR_SIZE, ProfileCover } from '../profile/ProfileCover';
import { profileDisplayName } from '../../lib/convIdentity';
import { getPeerHandle, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';
import { Column, pinnedEdges, PAGE_GUTTER } from '../layout';

const sidebarWidth = createPaneWidth({
  key: 'web.memberListWidth',
  initial: 260,
  min: 200,
  max: 400,
  styleId: 'stage-right-pane',
  css: rightPaneRule,
});

function PeerProfileSidebar({ address }: { address: string }): React.ReactElement {
  const { bg, border, text } = usePalette();
  usePeerProfiles([address]);
  const name = profileDisplayName(address);
  const handle = getPeerHandle(address);
  const identity = handle ? displayHandle(handle) : shortAddress(address);
  return (
    <ProfileCover
      insetTop={0}
      centered
      avatar={
        <Avatar
          key={address}
          address={address}
          size={PROFILE_AVATAR_SIZE}
          style={{ backgroundColor: border, borderWidth: 3, borderColor: bg }}
        />
      }
    >
      <Column padding={{ x: PAGE_GUTTER, bottom: PAGE_GUTTER }}>
        <Column gap={6} margin={{ top: 14 }}>
          <Text text={name} fontWeight="semibold" size="2xl" textAlign="center" numberOfLines={2} />
          {identity !== name ? <Text text={identity} size="xs" color={text} textAlign="center" numberOfLines={1} /> : null}
        </Column>
      </Column>
    </ProfileCover>
  );
}

export function ConversationSidebar({
  convId,
  isGroup = false,
  peerAddress = null,
}: {
  convId?: string;
  isGroup?: boolean;
  peerAddress?: string | null;
}): React.ReactElement {
  const { border } = usePalette();
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const width = sidebarWidth.use();
  return (
    <Column
      surface="surface"
      width={width}
      style={[pinnedEdges({ top, bottom: 0, right: 0 }, 2), { borderLeftWidth: 1, borderLeftColor: border }]}
    >
      {isGroup && convId ? (
        <MemberListSidebar convId={convId} />
      ) : peerAddress ? (
        <PeerProfileSidebar key={peerAddress} address={peerAddress} />
      ) : null}
      <PaneResizeHandle pane={sidebarWidth} edge="left" />
    </Column>
  );
}
