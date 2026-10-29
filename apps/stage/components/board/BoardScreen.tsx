import { useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { FilterSearch, memberNamesOf } from '../FilterSearch';
import { searchFilterSources, searchFilterValues } from '../searchFilter.model';
import { useHomeTopnav, useSearchOpen } from '../home/list';
import type { HomeMenuState } from '../home/topnavRight';
import { useLastActivityCutoff } from '../../lib/lastActivity';
import { HomeError, HomeSpinner } from '../home/parts';
import { homeRows } from '../home/state';
import { useChannelsSync } from '../home/sync';
import type { Row as ChannelRowData } from '../home/model';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useStoreValue } from '../../lib/storeCore';
import { usePinnedOrder } from '../../lib/pins';
import { useClearedChats } from '../../lib/clearedChats';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { reported } from '../../lib/errorPolicy';
import { useBoardOrder } from '../../lib/boardOrder';
import { useChannelGroups } from '../../lib/channelGroups';
import { useBoardQuery, useHomeViewOf } from '../../lib/homeView';
import { homeSortOf, sortHomeRows } from '../home/sort.model';
import { useBottomChromeHeight } from '../../lib/bottomChrome';
import { useWebTabRail } from '../../lib/webLayout';
import { boardColumns, cardLanding, columnsEditable, orderedColumns, searchedColumns } from './BoardScreen.model';
import { addBoardColumn, deleteBoardColumn, dropCard, dropColumn, renameBoardColumn } from './boardActions';
import { BoardLanes, type ColumnActions } from './BoardLanes';
import { Column, ScreenScroll } from '../layout';

function useMemberProfiles(rows: ChannelRowData[] | null, query: string, assignees: boolean): number {
  const members = searchFilterValues(query, 'member').length > 0 ? searchFilterSources(rows ?? [], 'board').members : [];
  const assigned = assignees ? (rows ?? []).flatMap((r) => r.assigned) : [];
  return usePeerProfiles([...(rows ?? []).map((r) => r.lastSenderAddress), ...members, ...assigned]);
}
function BoardBody({ query, filtering }: { query: string; filtering: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const pinned = usePinnedOrder();
  const cleared = useClearedChats();
  const boardOrder = useBoardOrder();
  const categoryOrder = useChannelGroups().order;
  const view = useHomeViewOf('board');
  const { columnBy } = view;
  const sort = homeSortOf(view);
  const order = columnBy === 'category' ? categoryOrder : boardOrder;
  const [error, setError] = useState<string>('');
  useChannelsSync({ accountEpoch: useAccountEpoch(), setError, enabled: Platform.OS === 'web' });
  const profiles = useMemberProfiles(rows, query, columnBy === 'assignee');
  const draftsVersion = useDraftsVersion();
  const columns = useMemo(
    () =>
      orderedColumns(
        boardColumns(rows ?? [], pinned, order, columnBy, peerLabel, (r) => isRowCleared(cleared, r), sort, boardOrder),
        order,
      ),
    [rows, cleared, pinned, order, columnBy, profiles, sort, boardOrder],
  );
  const activityCutoff = useLastActivityCutoff('board');
  const shown = useMemo(
    () => searchedColumns(columns, query, memberNamesOf, getDraft, activityCutoff),
    [columns, query, profiles, draftsVersion, activityCutoff],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg} />;
  if (!rows) return <HomeSpinner head={head} />;
  const actions: ColumnActions = {
    editable: columnsEditable(columnBy),
    dropCard: (convId, from, to) => {
      dropCard(columns, order, convId, from, to, columnBy);
    },
    dropColumn: (from, target) => {
      dropColumn(columns, order, from, target);
    },
    placeCard: (move) => cardLanding(shown, move, (list) => sortHomeRows(list, pinned, sort, boardOrder)),
    rename: (from, to) => {
      if (columnsEditable(columnBy)) void renameBoardColumn(rows, columns, order, from, to, columnBy).catch(reported('board.rename'));
    },
    remove: (label) => {
      if (columnsEditable(columnBy)) void deleteBoardColumn(rows, columns, order, label, columnBy).catch(reported('board.delete'));
    },
    create: (name) => {
      if (columnsEditable(columnBy)) addBoardColumn(columns, order, name, columnBy);
    },
  };
  return <BoardLanes key={columnBy} columns={shown} pinned={pinned} actions={actions} filtering={filtering} />;
}
function BoardFrame({
  pane,
  query,
  setQuery,
  onFilterMenu,
  menu,
  children,
}: {
  pane: boolean;
  query: string;
  setQuery: (query: string) => void;
  onFilterMenu: (open: boolean) => void;
  children: React.ReactNode;
  menu: HomeMenuState;
}): React.ReactElement {
  const { text, link, border } = usePalette();
  const wide = useWebTabRail();
  const search = useSearchOpen(query, setQuery);
  const slot = useHomeTopnav({ scope: 'board', pane, query, setQuery, onFilterMenu, menu }, search, wide);
  const [laneHeight, setLaneHeight] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScreenScroll>>(null);
  const openSearch = (): void => {
    scroll.current?.scrollToOffset({ offset: 0, animated: false });
    search.open();
  };
  const topnav = pane ? (slot.override ?? <Topnav inline right={slot.right} />) : null;
  if (wide)
    return (
      <>
        {topnav}
        {children}
      </>
    );
  return (
    <>
      {topnav}
      <Column
        weight={1}
        onLayout={(event) => {
          setLaneHeight(event.nativeEvent.layout.height);
        }}
      >
        <TopnavFade stickyTop={`${TOPNAV_HEIGHT}px`} />
        <ScreenScroll ref={scroll} contentContainerStyle={{ paddingTop: TOPNAV_FADE }} keyboardShouldPersistTaps="handled">
          <FilterSearch
            key={search.key}
            autoFocus={search.key > 0}
            query={query}
            setQuery={setQuery}
            onClose={search.close}
            onOpen={openSearch}
            head={link}
            sub={text}
            border={border}
          />
          <Column height={laneHeight}>{children}</Column>
        </ScreenScroll>
      </Column>
    </>
  );
}
function useBoardHeight(): number | undefined {
  const { height } = useWindowDimensions();
  const chrome = useBottomChromeHeight();
  if (Platform.OS !== 'web') return undefined;
  return height - TOPNAV_HEIGHT - chrome;
}
export function BoardScreen({ pane, menu }: { pane: boolean; menu: HomeMenuState }): React.ReactElement {
  const [query, setQuery] = useBoardQuery();
  const [filtering, setFiltering] = useState(false);
  const height = useBoardHeight();
  const windowHeight = !pane && height !== undefined;
  return (
    <Column weight={windowHeight ? undefined : 1} height={windowHeight ? height : undefined} surface="surface">
      <BoardFrame pane={pane} query={query} setQuery={setQuery} onFilterMenu={setFiltering} menu={menu}>
        <BoardBody query={query} filtering={filtering} />
      </BoardFrame>
    </Column>
  );
}
