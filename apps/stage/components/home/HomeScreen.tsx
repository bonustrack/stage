import { useMemo } from 'react';
import type { SimultaneousRefs } from '../layout/simultaneousRefs';
import { usePathname, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { peerLabel } from '../../lib/peerProfiles';
import { NewChatScreen } from '../newChat/NewChatScreen';
import { useWebTabRail } from '../layout/webLayout';
import { HomeError, HomeLoading, useChannelRowRenderer } from './parts';
import { RowChannelMenu } from '../chatRow/chatRow';
import { ChannelsList } from './list';
import { useChannelsSyncError } from '../../lib/messaging/channelsSync';
import { deriveBarLabels } from '@stage-labs/client/xmtp/channelsFilter';
import { searchBarLabels } from './model';
import { BoardScreen } from './board/BoardScreen';
import { useHomeListing } from './listing';
import { homeListing } from './listing.model';
import { groupingOrderOf } from '../../lib/grouping.model';
import { useGroupedRows, useHomeState } from './state';
import { HomeDragLists, useHomeDrag } from './listDrag';
import { useRowArrows } from './rowArrows';
import { useTabFocused } from '../tabs/useTabFocused';
import { PAGES } from '../tabs/pages';
import { Column } from '../layout';

export function HomeScreen({
  panRef,
  pane = false,
  board = false,
}: { panRef?: SimultaneousRefs; pane?: boolean; board?: boolean } = {}): React.ReactElement | null {
  const splitHome = useWebTabRail() && !pane;
  const accountEpoch = useAccountEpoch();
  if (splitHome) return board ? null : <NewChatScreen key={accountEpoch} />;
  if (board) return <BoardScreen pane={pane} />;
  return <ChannelsHome panRef={panRef} pane={pane} />;
}

export function BoardHome(): React.ReactElement | null {
  const here = usePathname() === PAGES.board.href;
  const opened = useTabFocused(PAGES.board.href);
  return here || opened ? <HomeScreen board /> : null;
}

function ChannelsHome({ panRef, pane }: { panRef?: SimultaneousRefs; pane: boolean }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const st = useHomeState();
  const { rowMenu } = st;
  const listing = useHomeListing('chats');
  const { rows, pinned, enabledLabels, unreadOnly, fields } = listing;
  const { query, searchText, matches, cleared, sort, orders, profilesVersion, draftsVersion } = listing;
  const { groupBy } = listing.view;
  const statusOrder = groupingOrderOf('status', orders);
  const labelOrder = groupingOrderOf('label', orders);

  const barLabels = useMemo(
    () => searchBarLabels(deriveBarLabels((rows ?? []).filter(matches)), enabledLabels, labelOrder),
    [rows, matches, enabledLabels, labelOrder],
  );
  const visibleRows = useMemo(
    () => homeListing({ rows, enabledLabels, unreadOnly, pinned, sort, statusOrder, matches, cleared }),
    [rows, pinned, enabledLabels, unreadOnly, sort, statusOrder, matches, cleared],
  );
  const list = useGroupedRows(visibleRows, searchText, groupBy, peerLabel, profilesVersion);
  const error = useChannelsSyncError();

  const activePath = pane ? pathname : '';
  const menuConvId = rowMenu?.convId;
  const listExtraData = useMemo(
    () => [profilesVersion, draftsVersion, pinned, query, activePath, menuConvId, fields] as const,
    [profilesVersion, draftsVersion, pinned, query, activePath, menuConvId, fields],
  );
  const visiblePinned = useMemo(
    () => (list.grouped ? [] : visibleRows.map((r) => r.convId).filter((id) => pinned.includes(id))),
    [list.grouped, visibleRows, pinned],
  );
  const drag = useHomeDrag(list.items, groupBy === 'category', pinned, visiblePinned);
  useRowArrows({ rows: list.rows, items: list.items, activePath, router, listRef: st.scroll.listRef });
  const renderRow = useChannelRowRenderer(router, st.setRowMenu, {
    channelProfilesVersion: profilesVersion,
    draftsVersion,
    pinned,
    query: searchText,
    activePath,
    menuConvId,
    drag,
    fields,
    items: list.items,
  });

  const placeholder = error ? <HomeError error={error} dark={dark} fg={fg} /> : !rows ? <HomeLoading head={head} /> : null;

  return (
    <Column weight={1} surface="surface">
      <ChannelsList
        panRef={panRef}
        items={list.items}
        rows={rows}
        barLabels={barLabels}
        placeholder={placeholder}
        enabledLabels={enabledLabels}
        unreadOnly={unreadOnly}
        query={query}
        listExtraData={listExtraData}
        scroll={st.scroll}
        renderRow={renderRow}
        wrapList={(node) => <HomeDragLists drag={drag}>{node}</HomeDragLists>}
        pane={pane}
      />
      <RowChannelMenu
        menu={rowMenu}
        onClose={() => {
          st.setRowMenu(null);
        }}
      />
    </Column>
  );
}
