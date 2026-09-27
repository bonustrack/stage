import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Box, Row, VirtualList, pinnedEdges, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { TOPNAV_HEIGHT } from '../Topnav';
import { useSelfAddress } from '../ProfileScreen.parts';
import { createPaneWidth } from '../tabs/paneWidth';
import { PaneResizeHandle } from '../tabs/PaneResizeHandle';
import type { MemberListState } from '../ChannelMenu.model';
import { memberListEntries, type MemberListEntry } from './MemberListSidebar.model';
import { useConvMeta, shortAddress } from '../../modules/messaging';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { useMemberListOpen } from '../../lib/memberList';
import { profileLinkOf } from '../../lib/links';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useWebTabRail } from '../../lib/webLayout';
import { usePalette, withAlpha } from '../../lib/theme';

const memberListWidth = createPaneWidth({
  key: 'web.memberListWidth',
  initial: 260,
  min: 200,
  max: 400,
  styleId: 'stage-right-pane',
  css: (width) => `:root { --stage-right-pane: ${width}px; }`,
});

const ROW_HEIGHT = 44;
const ROW_INSET = 8;

export function useMemberListState(isGroup: boolean): MemberListState | undefined {
  const open = useMemberListOpen();
  const wide = useWebTabRail();
  if (!wide || !isGroup) return undefined;
  return open ? 'shown' : 'hidden';
}

function MemberListRow({ entry, onPress }: { entry: MemberListEntry; onPress: () => void }): React.ReactElement {
  const { link, border } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW_HEIGHT,
        marginHorizontal: ROW_INSET, paddingHorizontal: PAGE_GUTTER - ROW_INSET, borderRadius: 8,
        backgroundColor: pressed ? withAlpha(link, DROPDOWN_MENU.pressedAlpha) : 'transparent',
      })}
>
      <Avatar address={entry.address} size="md" style={{ backgroundColor: border }}/>
      <Text size="lg" weight="medium" numberOfLines={1} style={{ flex: 1 }}>{entry.name}</Text>
    </Pressable>
  );
}

export function MemberListSidebar({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const { border } = usePalette();
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const { memberAddrs } = useConvMeta(convId);
  const self = useSelfAddress();
  const addresses = useMemo(() => (self ? [self, ...memberAddrs] : memberAddrs), [self, memberAddrs]);
  const profiles = usePeerProfiles(addresses);
  const entries = useMemo(
    () => memberListEntries(addresses, getPeerName, shortAddress),
    [addresses, profiles],
  );
  const width = memberListWidth.use();
  return (
    <Box
      surface="surface"
      width={width}
      style={[pinnedEdges({ top, bottom: 0, right: 0 }, 2), { borderLeftWidth: 1, borderLeftColor: border }]}
>
      <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
        <Eyebrow>MEMBERS</Eyebrow>
        <CountTag count={entries.length}/>
      </Row>
      <VirtualList
        scroll="self"
        data={entries}
        extraData={profiles}
        keyExtractor={(entry) => entry.address.toLowerCase()}
        contentContainerStyle={{ paddingBottom: PAGE_GUTTER }}
        renderItem={({ item }) => (
          <MemberListRow entry={item} onPress={() => { router.push(profileLinkOf(item.address)); }}/>
        )}
      />
      <PaneResizeHandle pane={memberListWidth} edge="left"/>
    </Box>
  );
}
