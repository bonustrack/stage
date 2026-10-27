import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, type DimensionValue } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { FilterSearch, memberNamesOf } from '../FilterSearch';
import { searchFilterSources, searchFilterValues } from '../searchFilter.model';
import { useHomeTopnav, useSearchOpen } from '../home/list';
import type { HomeMenuState } from '../home/topnavRight';
import { ChannelRow } from '../ChannelRow';
import { ChannelRowFields } from '../ChannelRowFields';
import { useChannelFields } from '../../lib/channelFields';
import { useLastActivityCutoff } from '../../lib/lastActivity';
import { CountTag } from '../CountTag';
import { NewChatAction } from '../home/NewChatAction';
import { HomeError, HomeSpinner, RowChannelMenu, rowAvatarAddress, rowMenuOpener, rowPreview, rowTitle } from '../home/parts';
import { homeRows, type RowMenu } from '../home/state';
import { useChannelsSync } from '../home/sync';
import type { Row as ChannelRowData } from '../home/model';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useStoreValue } from '../../lib/storeCore';
import { usePinnedOrder } from '../../lib/pins';
import { useClearedChats } from '../../lib/clearedChats';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { conversationLinkOf } from '../../lib/links';
import { channelTimestamp } from '../../lib/format';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { reported } from '../../lib/errorPolicy';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useBoardOrder } from '../../lib/boardOrder';
import { useChannelGroups } from '../../lib/channelGroups';
import { useBoardQuery, useHomeView, useHomeViewOf } from '../../lib/homeView';
import { homeSortOf, sortHomeRows } from '../home/sort.model';
import { capabilities } from '../../lib/capabilities';
import { useBottomChromeHeight } from '../../lib/bottomChrome';
import { useWebTabRail } from '../../lib/webLayout';
import { BOARD_ROUTE, channelRouteConvId } from '../tabs/splitRoutes';
import {
  BOARD_GAP, acceptsCardMove, acceptsColumnMove, activeColumnIndex, boardCardPress, boardColumns, cardLanding, cardsRightPadding, columnEditable,
  columnMovable, columnsEditable, orderedColumns, revealScrollX, searchedColumns, type BoardColumn,
} from './BoardScreen.model';
import { revealMarked, useArrowKeys } from '../arrowKeys';
import { ALL_ARROWS, type MarkedNode } from '../arrowKeys.model';
import { boardArrowMove } from './boardKeys.model';
import { addBoardColumn, deleteBoardColumn, dropCard, dropColumn, renameBoardColumn } from './boardActions';
import {
  AddColumn, CARD_GAP, COLUMN_PADDING, ColumnFrame, ColumnMenu, ColumnTitle, HEADER_PADDING, RenameHeading,
} from './BoardColumnEdit';
import { List } from '@stage-labs/kit/react-native/list';
import { SortableHandle, SortableItem, SortableList, SortableScope } from '@stage-labs/kit/react-native/sortable';
import { moveAnchor, type SortMove } from '@stage-labs/kit/sortable';
import { Column, Row, ScreenScroll, GUTTER_SCROLLBAR, LIST_TOP_GAP, PAGE_GUTTER, SELF_SCROLLBAR, gutterScrollbarWidth } from '../layout';

const GROW = { flexGrow: 1, flexShrink: 1 };
const SHRINK = { flexShrink: 1, minHeight: 0 };
const LANE = { alignSelf: 'stretch', alignItems: 'flex-start' } as const;
const FILL = { flex: 1 };
type BoardRouter = ReturnType<typeof useRouter>;
const cardDataSet = (columnKey: string, convId: string): MarkedNode => (
  { dataSet: { boardcard: convId, boardcolumn: columnKey } }
);

function showInPanel(router: BoardRouter, convId: string, press: 'push' | 'replace'): void {
  const link = conversationLinkOf(convId, null);
  if (press === 'push') router.push(link);
  else router.replace(link);
}
interface ColumnActions {
  editable: boolean;
  dropCard: (convId: string, from: string, to: string) => void;
  dropColumn: (from: string, target: string) => void;
  placeCard: (move: SortMove) => number;
  rename: (from: string, to: string) => void;
  remove: (label: string) => void;
  create: (name: string) => void;
}
function columnMaxHeight(laneHeight: number): DimensionValue | undefined {
  if (Platform.OS === 'web') return '100%';
  return laneHeight > 0 ? laneHeight : undefined;
}

function BoardCard({ item, pinned, columnKey, editable, onOpen }: {
  item: ChannelRowData; pinned: boolean; columnKey: string; editable: boolean; onOpen: () => void;
}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const panel = useWebTabRail();
  const { bg, link } = usePalette();
  const openConvId = channelRouteConvId(pathname);
  const draftText = getDraft(item.convId);
  const fields = useChannelFields('board');
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const openMenu = rowMenuOpener(item, setMenu);
  const title = rowTitle(item);
  return (
    <SortableItem itemId={item.convId} disabled={!editable} onHold={openMenu}>
    <Column
      {...cardDataSet(columnKey, item.convId)}
      surface="surface"
      radius={BLOCK_RADIUS_DEFAULT}
      style={{
        overflow: 'hidden',
        borderWidth: 1, borderColor: (panel && openConvId === item.convId) || menu !== null ? link : bg,
      }}
    >
      <ChannelRow
        title={title.text}
        placeholderTitle={title.placeholder}
        avatarUri={item.avatarUri} avatarAddress={rowAvatarAddress(item)} square={!item.peerAddress}
        hideAvatar={!fields.avatar} wrapTitle
        lastPreview={rowPreview(item)}
        showPreview={fields.lastMessage}
        timestamp={channelTimestamp(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={pinned}
        draftText={draftText}
        fields={<ChannelRowFields data={item} fields={fields}/>}
        onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
        onPress={() => {
          if (!panel) {
            router.push(conversationLinkOf(item.convId, item.peerAddress));
            return;
          }
          const press = boardCardPress(openConvId, item.convId);
          if (press === 'close') {
            capabilities.backTo(BOARD_ROUTE);
            return;
          }
          onOpen();
          showInPanel(router, item.convId, press);
        }}
        onLongPress={editable ? undefined : openMenu}
        onContextMenu={openMenu}
      />
      <RowChannelMenu menu={menu} isPinned={pinned} onClose={() => { setMenu(null); }}/>
    </Column>
    </SortableItem>
  );
}

function ColumnCards({ column, pinned, editable, placeholder, onOpen }: {
  column: BoardColumn<ChannelRowData>; pinned: readonly string[]; editable: boolean; placeholder: React.ReactNode; onOpen: (key: string) => void;
}): React.ReactElement | null {
  if (column.rows.length === 0 && placeholder === null) return null;
  return (
    <List
      {...GUTTER_SCROLLBAR}
      gap={CARD_GAP}
      nestedScrollEnabled
      style={{ flexGrow: 0, flexShrink: 1 }}
      contentContainerStyle={{ paddingRight: cardsRightPadding(COLUMN_PADDING, gutterScrollbarWidth()) }}
    >
      {column.rows.map(item => (
        <BoardCard
          key={item.convId} item={item} pinned={pinned.includes(item.convId)} columnKey={column.key} editable={editable}
          onOpen={() => { onOpen(column.key); }}
        />
      ))}
      {placeholder}
    </List>
  );
}

function BoardColumnView({ column, columns, maxHeight, pinned, actions, onOpen }: {
  column: BoardColumn<ChannelRowData>;
  columns: readonly BoardColumn<ChannelRowData>[];
  maxHeight?: DimensionValue;
  pinned: readonly string[];
  actions: ColumnActions;
  onOpen: (key: string) => void;
}): React.ReactElement {
  const { label } = column;
  const { columnBy } = useHomeView();
  const editable = actions.editable && columnEditable(column.key);
  const [editing, setEditing] = useState(false);
  const heading = editing ? (
    <RenameHeading
      label={label} columns={columns} count={column.rows.length} onRename={actions.rename}
      onClose={() => { setEditing(false); }}
    />
  ) : (
    <Row align="center" gap={8} padding={{ right: HEADER_PADDING.right }}>
      <SortableHandle style={GROW}>
        <Row align="center" gap={8} padding={{ left: HEADER_PADDING.left, y: HEADER_PADDING.y }}>
          <ColumnTitle label={label} onPress={editable ? () => { setEditing(true); } : undefined}/>
          <CountTag count={column.rows.length}/>
          <Column weight={1}/>
        </Row>
      </SortableHandle>
      {editable ? <ColumnMenu onDelete={() => { actions.remove(label); }}/> : null}
      <NewChatAction by={columnBy} groupKey={column.key} title={label}/>
    </Row>
  );
  return (
    <SortableItem itemId={column.key} handle disabled={editing || !columnMovable(column.key)} style={maxHeight === undefined ? undefined : { maxHeight }}>
      <SortableList
        listId={column.key} group="cards" itemIds={column.rows.map(row => row.convId)} keyboard={false} style={SHRINK}
        accepts={acceptsCardMove} placeAt={actions.placeCard} onMove={(move) => { actions.dropCard(move.itemId, move.fromListId, column.key); }}
      >
        {({ over, placeholder }) => (
          <ColumnFrame over={over} shrink>
            {heading}
            <ColumnCards column={column} pinned={pinned} editable={actions.editable} placeholder={placeholder} onOpen={onOpen}/>
          </ColumnFrame>
        )}
      </SortableList>
    </SortableItem>
  );
}

function useCardArrows({ columns, openIndex, openConvId, paused, onMove }: {
  columns: readonly BoardColumn<ChannelRowData>[];
  openIndex: number;
  openConvId: string | null;
  paused: boolean;
  onMove: (key: string) => void;
}): void {
  const router = useRouter();
  useArrowKeys(useWebTabRail() && openConvId !== null && !paused, ALL_ARROWS, (arrow) => {
    const card = boardArrowMove(columns, openIndex, openConvId, arrow);
    if (card === null) return;
    onMove(card.key);
    if (card.convId !== openConvId) {
      prefetchFeed(lineOfConv(card.convId));
      showInPanel(router, card.convId, 'replace');
    }
    revealMarked(cardDataSet(card.key, card.convId));
  });
}

function BoardLanes({ columns, pinned, actions, filtering }: {
  columns: BoardColumn<ChannelRowData>[];
  pinned: readonly string[];
  actions: ColumnActions;
  filtering: boolean;
}): React.ReactElement {
  const { bottom } = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const scroll = useRef<React.ComponentRef<typeof List>>(null);
  const scrollX = useRef(0);
  const reveal = useRef(false);
  const padding = { paddingHorizontal: PAGE_GUTTER, paddingTop: LIST_TOP_GAP, paddingBottom: LIST_TOP_GAP + bottom };
  const laneHeight = frame.height - padding.paddingTop - padding.paddingBottom;
  const [openedFrom, setOpenedFrom] = useState<string | null>(null);
  const openConvId = channelRouteConvId(usePathname());
  const openIndex = activeColumnIndex(columns, openConvId, openedFrom);
  const revealColumn = (index: number): void => {
    if (index === -1 || frame.width === 0) return;
    const x = revealScrollX(index, scrollX.current, frame.width, PAGE_GUTTER);
    if (x !== scrollX.current) scroll.current?.scrollTo({ x, animated: true });
  };
  useEffect(() => { revealColumn(openIndex); }, [openIndex, frame.width]);
  useCardArrows({
    columns, openIndex, openConvId, paused: filtering,
    onMove: (key) => { setOpenedFrom(key); revealColumn(columns.findIndex(column => column.key === key)); },
  });
  const revealEnd = (): void => {
    if (!reveal.current) return;
    reveal.current = false;
    scroll.current?.scrollToEnd({ animated: true });
  };
  return (
    <SortableScope style={FILL}>
    <List
      ref={scroll}
      direction="horizontal"
      {...SELF_SCROLLBAR}
      gap={BOARD_GAP}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={{ ...padding, alignItems: 'flex-start' }}
      onLayout={(e) => { setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }); }}
      onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
      scrollEventThrottle={16}
      onContentSizeChange={revealEnd}
    >
      <SortableList
        listId="board-columns" group="columns" direction="horizontal" gap={BOARD_GAP} keyboard={false} style={LANE}
        itemIds={columns.map(column => column.key)} accepts={acceptsColumnMove}
        onMove={(move) => { const target = moveAnchor(move); if (target !== null) actions.dropColumn(move.itemId, target); }}
      >
        {columns.map(column => (
          <BoardColumnView
            key={column.key}
            column={column} columns={columns} pinned={pinned}
            maxHeight={columnMaxHeight(laneHeight)}
            actions={actions} onOpen={setOpenedFrom}
          />
        ))}
      </SortableList>
      {actions.editable ? <AddColumn columns={columns} onAdd={actions.create} onReveal={() => { reveal.current = true; }}/> : null}
    </List>
    </SortableScope>
  );
}
function useMemberProfiles(rows: ChannelRowData[] | null, query: string, assignees: boolean): number {
  const members = searchFilterValues(query, 'member').length > 0 ? searchFilterSources(rows ?? [], 'board').members : [];
  const assigned = assignees ? (rows ?? []).flatMap(r => r.assigned) : [];
  return usePeerProfiles([...(rows ?? []).map(r => r.lastSenderAddress), ...members, ...assigned]);
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
    () => orderedColumns(boardColumns(rows ?? [], pinned, order, columnBy, peerLabel, r => isRowCleared(cleared, r), sort, boardOrder), order),
    [rows, cleared, pinned, order, columnBy, profiles, sort, boardOrder],
  );
  const activityCutoff = useLastActivityCutoff('board');
  const shown = useMemo(
    () => searchedColumns(columns, query, memberNamesOf, getDraft, activityCutoff),
    [columns, query, profiles, draftsVersion, activityCutoff],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  const actions: ColumnActions = {
    editable: columnsEditable(columnBy),
    dropCard: (convId, from, to) => { dropCard(columns, order, convId, from, to, columnBy); },
    dropColumn: (from, target) => { dropColumn(columns, order, from, target); },
    placeCard: move => cardLanding(shown, move, list => sortHomeRows(list, pinned, sort, boardOrder)),
    rename: (from, to) => {
      if (columnsEditable(columnBy)) void renameBoardColumn(rows, columns, order, from, to, columnBy).catch(reported('board.rename'));
    },
    remove: (label) => {
      if (columnsEditable(columnBy)) void deleteBoardColumn(rows, columns, order, label, columnBy).catch(reported('board.delete'));
    },
    create: (name) => { if (columnsEditable(columnBy)) addBoardColumn(columns, order, name, columnBy); },
  };
  return <BoardLanes key={columnBy} columns={shown} pinned={pinned} actions={actions} filtering={filtering}/>;
}
function BoardFrame({ pane, query, setQuery, onFilterMenu, menu, children }: {
  pane: boolean; query: string; setQuery: (query: string) => void; onFilterMenu: (open: boolean) => void;
  children: React.ReactNode; menu: HomeMenuState;
}): React.ReactElement {
  const { text, link, border } = usePalette();
  const wide = useWebTabRail();
  const search = useSearchOpen(query, setQuery);
  const slot = useHomeTopnav({ scope: 'board', pane, query, setQuery, onFilterMenu, menu }, search, wide);
  const [laneHeight, setLaneHeight] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScreenScroll>>(null);
  const openSearch = (): void => { scroll.current?.scrollToOffset({ offset: 0, animated: false }); search.open(); };
  const topnav = pane ? slot.override ?? <Topnav inline right={slot.right}/> : null;
  if (wide) return <>{topnav}{children}</>;
  return <>
    {topnav}
    <Column weight={1} onLayout={event => { setLaneHeight(event.nativeEvent.layout.height); }}>
      <TopnavFade stickyTop={`${TOPNAV_HEIGHT}px`}/>
      <ScreenScroll ref={scroll} contentContainerStyle={{ paddingTop: TOPNAV_FADE }} keyboardShouldPersistTaps="handled">
        <FilterSearch
          key={search.key} autoFocus={search.key > 0}
          query={query} setQuery={setQuery} onClose={search.close} onOpen={openSearch}
          head={link} sub={text} border={border}
        />
        <Column height={laneHeight}>{children}</Column>
      </ScreenScroll>
    </Column>
  </>;
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
        <BoardBody query={query} filtering={filtering}/>
      </BoardFrame>
    </Column>
  );
}
