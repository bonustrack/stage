import { MemberListSidebar } from './MemberListSidebar';
import { PeerProfileSidebar } from './PeerProfileSidebar';
import { Box, pinnedEdges } from '../layout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { createPaneWidth } from '../tabs/paneWidth';
import { PaneResizeHandle } from '../tabs/PaneResizeHandle';
import type { MemberListState } from '../ChannelMenu.model';
import { useMemberListOpen } from '../../lib/memberList';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useWebTabRail } from '../../lib/webLayout';
import { usePalette } from '../../lib/theme';

const sidebarWidth = createPaneWidth({
  key: 'web.memberListWidth',
  initial: 260,
  min: 200,
  max: 400,
  styleId: 'stage-right-pane',
  css: (width) => `:root { --stage-right-pane: ${width}px; }`,
});

export function useConversationSidebarState(isGroup: boolean, peerAddress?: string | null): MemberListState | undefined {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  if (!wide || (!isGroup && !peerAddress)) return undefined;
  return open ? 'shown' : 'hidden';
}

export function ConversationSidebar({ convId, isGroup, peerAddress }: {
  convId: string; isGroup: boolean; peerAddress: string | null;
}): React.ReactElement {
  const { border } = usePalette();
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const width = sidebarWidth.use();
  return (
    <Box
      surface="surface"
      width={width}
      style={[pinnedEdges({ top, bottom: 0, right: 0 }, 2), { borderLeftWidth: 1, borderLeftColor: border }]}
>
      {isGroup ? <MemberListSidebar convId={convId}/> : peerAddress ? <PeerProfileSidebar key={peerAddress} address={peerAddress}/> : null}
      <PaneResizeHandle pane={sidebarWidth} edge="left"/>
    </Box>
  );
}
