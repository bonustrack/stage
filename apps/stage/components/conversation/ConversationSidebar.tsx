import { MemberListSidebar } from './MemberListSidebar';
import type { StyleProp, ViewStyle } from 'react-native';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Box, Col, PANE_LEFT_PAD, RIGHT_PANE_PAD, pinnedEdges, viewportFill, PAGE_GUTTER } from '../layout';
import { TOPNAV_HEIGHT } from '../Topnav';
import { createPaneWidth } from '../tabs/paneWidth';
import { PaneResizeHandle } from '../tabs/PaneResizeHandle';
import { useMemberListOpen } from '../../lib/memberList';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useWebTabRail } from '../../lib/webLayout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { PROFILE_AVATAR_SIZE, ProfileCover } from '../ProfileCover';
import { profileDisplayName } from '../ProfileScreen.model';
import { getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';

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

export function ChatColumnSpinner({ bottomInset }: { bottomInset: number }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col surface="surface" flex={1} align="center" justify="center" style={useChatColumnFill(bottomInset)}>
      <Spinner size={24} color={dark ? '#ffffff' : '#000000'}/>
    </Col>
  );
}

function PeerProfileSidebar({ address }: { address: string }): React.ReactElement {
  const { bg, border, text } = usePalette();
  usePeerProfiles([address]);
  const name = profileDisplayName(address, getPeerName(address), shortAddress(address));
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
      <Box padding={{ x: PAGE_GUTTER, bottom: PAGE_GUTTER }}>
        <Col gap={6} margin={{ top: 14 }}>
          <Text value={name} weight="semibold" size="2xl" textAlign="center" numberOfLines={2}/>
          {identity !== name ? <Text value={identity} size="2xs" color={text} textAlign="center" numberOfLines={1}/> : null}
        </Col>
      </Box>
    </ProfileCover>
  );
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
