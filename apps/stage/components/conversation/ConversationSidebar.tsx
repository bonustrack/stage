import { MemberListSidebar } from './MemberListSidebar';
import { PeerProfileSidebar } from './PeerProfileSidebar';
import type { StyleProp, ViewStyle } from 'react-native';
import { Box, PANE_LEFT_PAD, RIGHT_PANE_PAD, pinnedEdges, viewportFill } from '../layout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { createPaneWidth } from '../tabs/paneWidth';
import { PaneResizeHandle } from '../tabs/PaneResizeHandle';
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

export function useConversationSidebarShown(): boolean {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  return wide && open;
}

export function useChatColumnFill(bottomInset: number): StyleProp<ViewStyle> {
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const shown = useConversationSidebarShown();
  return [viewportFill(), PANE_LEFT_PAD, shown ? RIGHT_PANE_PAD : null, { paddingTop: top, paddingBottom: bottomInset }];
}

export function ConversationSidebar({ convId, isGroup = false, peerAddress = null }: {
  convId?: string; isGroup?: boolean; peerAddress?: string | null;
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
      {isGroup && convId ? <MemberListSidebar convId={convId}/> : peerAddress ? <PeerProfileSidebar key={peerAddress} address={peerAddress}/> : null}
      <PaneResizeHandle pane={sidebarWidth} edge="left"/>
    </Box>
  );
}
