import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import {
  Box, Col, Row, ScreenScroll, GUTTER_SCROLLBAR, LIST_TOP_GAP, PAGE_GUTTER, SELF_SCROLLBAR, gutterScrollbarWidth,
} from '../layout';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { FilterSearch, memberNamesOf } from '../FilterSearch';
import { searchFilterSources, searchFilterValues } from '../searchFilter.model';
import { useHomeTopnav, useSearchOpen } from '../home/list';
import { ChannelRow } from '../ChannelRow';
import { LabelText } from '../LabelText';
import { CountTag } from '../CountTag';
import { HomeError, HomeSpinner, RowChannelMenu, rowMenuOpener, rowPreview, rowTitle } from '../home/parts';
import { homeRows, type RowMenu } from '../home/state';
import { useChannelsSync } from '../home/sync';
import type { Row as ChannelRowData } from '../home/model';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { shortAddress } from '@stage-labs/client/identity/format';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useStoreValue } from '../../lib/storeCore';
import { usePinnedOrder } from '../../lib/pins';
import { useClearedChats } from '../../lib/clearedChats';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { conversationLinkOf } from '../../lib/links';
import { channelTimestamp } from '../../lib/format';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { reported } from '../../lib/errorPolicy';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useBoardOrder } from '../../lib/boardOrder';
import { useChannelGroups } from '../../lib/channelGroups';
import { useHomeView } from '../../lib/homeView';
import { capabilities } from '../../lib/capabilities';
import { useBottomChromeHeight } from '../../lib/bottomChrome';
import { useWebTabRail } from '../../lib/webLayout';
import { channelRouteConvId } from '../tabs/splitRoutes';
import {
  BOARD_GAP, activeColumnIndex, boardCardPress, boardColumns, cardsRightPadding, columnEditable, columnMovable, columnsEditable, orderedColumns,
  revealScrollX, searchedColumns, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';
import { useBoardDragSource, useBoardDropZone } from './boardDrag';
import { revealMarked, useArrowKeys } from '../arrowKeys';
import { ALL_ARROWS, type MarkedNode } from '../arrowKeys.model';
import { boardArrowMove } from './boardKeys.model';
import { addBoardColumn, addToBoardColumn, deleteBoardColumn, dropOnBoard, renameBoardColumn } from './boardActions';
import { AddItemButton, AddItemModal } from './BoardAddItem';
import {
  AddColumn, CARD_GAP, COLUMN_PADDING, ColumnFrame, ColumnMenu, HEADER_PADDING, RenameHeading, TITLE_SIZE,
} from './BoardColumnEdit';

const DRAGGING_OPACITY = 0.4;

type BoardRouter = ReturnType<typeof useRouter>;

const cardDataSet = (columnKey: string, convId: string): MarkedNode => (
  { dataSet: { boardcard: convId, boardcolumn: columnKey } }
);

function showInPanel(router: BoardRouter, convId: string, press: 'push' | 'replace'): void {
  const link = conversationLinkOf(convId, null);
  if (press === 'push') router.push(link);
  else router.replace(link);
}

const assigneeName = (address: string): string => getPeerName(address) ?? shortAddress(address);

interface ColumnActions {
  editable: boolean;
  drop: (drag: BoardDrag, key: string) => void;
  rename: (from: string, to: string) => void;
  remove: (label: string) => void;
  add: (label: string) => void;
  create: (name: string) => void;
}

function columnMaxHeight(laneHeight: number): number | string | undefined {
  if (Platform.OS === 'web') return '100%';
  return laneHeight > 0 ? laneHeight : undefined;
}

function BoardCard({ item, pinned, columnKey, editable, onOpen }: {
  item: ChannelRowData; pinned: boolean; columnKey: string; editable: boolean; onOpen: () => void;
}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const panel = useWebTabRail();
  const { border, link } = usePalette();
  const openConvId = channelRouteConvId(pathname);
  const draftText = getDraft(item.convId);
  const source = useBoardDragSource(editable ? { kind: 'card', convId: item.convId, from: columnKey } : null);
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const openMenu = rowMenuOpener(item, setMenu);
  const title = rowTitle(item);
  return (
    <Box
      {...cardDataSet(columnKey, item.convId)}
      nativeID={source.nativeID}
      background={border}
      radius={BLOCK_RADIUS_DEFAULT}
      style={{
        overflow: 'hidden', opacity: source.dragging ? DRAGGING_OPACITY : 1,
        borderWidth: 1, borderColor: (panel && openConvId === item.convId) || menu !== null ? link : border,
      }}
    >
      <ChannelRow
        title={title.text}
        placeholderTitle={title.placeholder}
        hideAvatar
        wrapTitle
        lastPreview={rowPreview(item)}
        timestamp={channelTimestamp(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={pinned}
        draftText={draftText}
        onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
        onPress={() => {
          if (!panel) {
            router.push(conversationLinkOf(item.convId, item.peerAddress));
            return;
          }
          const press = boardCardPress(openConvId, item.convId);
          if (press === 'close') {
            capabilities.backTo('/');
            return;
          }
          onOpen();
          showInPanel(router, item.convId, press);
        }}
        onLongPress={source.nativeID === undefined ? openMenu : undefined}
        onContextMenu={openMenu}
      />
      <RowChannelMenu menu={menu} isPinned={pinned} onClose={() => { setMenu(null); }}/>
    </Box>
  );
}

function ColumnTitle({ label, onPress }: { label: string; onPress?: () => void }): React.ReactElement {
  const title = <LabelText label={label} size={TITLE_SIZE} weight="semibold" truncate/>;
  if (onPress === undefined) return <Box style={{ flexShrink: 1 }}>{title}</Box>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Rename column" style={{ flexShrink: 1 }}>
      {title}
    </Pressable>
  );
}

function ColumnCards({ column, pinned, editable, onOpen }: {
  column: BoardColumn<ChannelRowData>; pinned: readonly string[]; editable: boolean; onOpen: (key: string) => void;
}): React.ReactElement | null {
  if (column.rows.length === 0) return null;
  return (
    <Scroll
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
    </Scroll>
  );
}

function BoardColumnView({ column, columns, maxHeight, pinned, actions, onOpen }: {
  column: BoardColumn<ChannelRowData>;
  columns: readonly BoardColumn<ChannelRowData>[];
  maxHeight?: number | string;
  pinned: readonly string[];
  actions: ColumnActions;
  onOpen: (key: string) => void;
}): React.ReactElement {
  const { label } = column;
  const editable = actions.editable && columnEditable(column.key);
  const [editing, setEditing] = useState(false);
  const zone = useBoardDropZone(column.key, (drag) => { actions.drop(drag, column.key); });
  const handle = useBoardDragSource(editing || !columnMovable(column.key) ? null : { kind: 'column', key: column.key }, zone.nativeID);
  return (
    <ColumnFrame
      nativeID={zone.nativeID} over={zone.over} opacity={handle.dragging ? DRAGGING_OPACITY : 1} maxHeight={maxHeight}
    >
      {editing ? (
        <RenameHeading
          label={label} columns={columns} count={column.rows.length} onRename={actions.rename}
          onClose={() => { setEditing(false); }}
        />
      ) : (
        <Row align="center" gap={8} padding={{ right: HEADER_PADDING.right }}>
          <Row nativeID={handle.nativeID} flex={1} align="center" gap={8} padding={{ left: HEADER_PADDING.left, y: HEADER_PADDING.y }}>
            <ColumnTitle label={label} onPress={editable ? () => { setEditing(true); } : undefined}/>
            <CountTag count={column.rows.length}/>
            <Box flex={1}/>
          </Row>
          {editable ? <ColumnMenu onDelete={() => { actions.remove(label); }}/> : null}
        </Row>
      )}
      <ColumnCards column={column} pinned={pinned} editable={actions.editable} onOpen={onOpen}/>
      {editable ? <AddItemButton onPress={() => { actions.add(label); }}/> : null}
    </ColumnFrame>
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
  const scroll = useRef<React.ComponentRef<typeof Scroll>>(null);
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
    <Scroll
      ref={scroll}
      horizontal
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
      {columns.map(column => (
        <BoardColumnView
          key={column.key}
          column={column} columns={columns} pinned={pinned}
          maxHeight={columnMaxHeight(laneHeight)}
          actions={actions} onOpen={setOpenedFrom}
        />
      ))}
      {actions.editable ? <AddColumn columns={columns} onAdd={actions.create} onReveal={() => { reveal.current = true; }}/> : null}
    </Scroll>
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
  const { columnBy } = useHomeView();
  const order = columnBy === 'category' ? categoryOrder : boardOrder;
  const [error, setError] = useState<string>('');
  const [adding, setAdding] = useState<string | null>(null);
  useChannelsSync({ accountEpoch: useAccountEpoch(), setError });
  const profiles = useMemberProfiles(rows, query, columnBy === 'assignee');
  const draftsVersion = useDraftsVersion();
  const columns = useMemo(
    () => orderedColumns(boardColumns(rows ?? [], pinned, order, columnBy, assigneeName, r => isRowCleared(cleared, r)), order),
    [rows, cleared, pinned, order, columnBy, profiles],
  );
  const shown = useMemo(
    () => searchedColumns(columns, query, memberNamesOf, getDraft),
    [columns, query, profiles, draftsVersion],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  const actions: ColumnActions = {
    editable: columnsEditable(columnBy),
    drop: (drag, key) => { dropOnBoard(columns, order, drag, key, columnBy); },
    rename: (from, to) => {
      if (columnsEditable(columnBy)) void renameBoardColumn(rows, columns, order, from, to, columnBy).catch(reported('board.rename'));
    },
    remove: (label) => {
      if (columnsEditable(columnBy)) void deleteBoardColumn(rows, columns, order, label, columnBy).catch(reported('board.delete'));
    },
    add: setAdding,
    create: (name) => { if (columnsEditable(columnBy)) addBoardColumn(columns, order, name, columnBy); },
  };
  const addPicked = (convIds: string[]): void => {
    setAdding(null);
    if (adding !== null && columnsEditable(columnBy)) void addToBoardColumn(convIds, adding, columnBy).catch(reported('board.add'));
  };
  return (
    <>
      <BoardLanes key={columnBy} columns={shown} pinned={pinned} actions={actions} filtering={filtering}/>
      {columnsEditable(columnBy) ? (
        <AddItemModal by={columnBy} label={adding} rows={rows} onClose={() => { setAdding(null); }} onAdd={addPicked}/>
      ) : null}
    </>
  );
}

function BoardFrame({ pane, query, setQuery, onFilterMenu, children }: {
  pane: boolean; query: string; setQuery: (query: string) => void; onFilterMenu: (open: boolean) => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { text, link, border } = usePalette();
  const wide = useWebTabRail();
  const search = useSearchOpen(query, setQuery, wide);
  const slot = useHomeTopnav({ scope: 'board', pane, query, setQuery, onFilterMenu }, search, wide);
  const [laneHeight, setLaneHeight] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScreenScroll>>(null);
  const openSearch = (): void => { scroll.current?.scrollToOffset({ offset: 0, animated: false }); search.open(); };
  const topnav = pane ? slot.override ?? <Topnav inline right={slot.right}/> : null;
  if (wide) return <>{topnav}{children}</>;
  return <>
    {topnav}
    <Box flex={1} onLayout={event => { setLaneHeight(event.nativeEvent.layout.height); }}>
      <TopnavFade stickyTop={`${TOPNAV_HEIGHT}px`}/>
      <ScreenScroll ref={scroll} contentContainerStyle={{ paddingTop: TOPNAV_FADE }} keyboardShouldPersistTaps="handled">
        <FilterSearch
          key={search.key} scope="board" onMenu={onFilterMenu} autoFocus={search.key > 0}
          query={query} setQuery={setQuery} onClose={search.close} onOpen={openSearch}
          head={link} sub={text} border={border}
        />
        <Col height={laneHeight}>{children}</Col>
      </ScreenScroll>
    </Box>
  </>;
}

function useBoardHeight(): number | undefined {
  const { height } = useWindowDimensions();
  const chrome = useBottomChromeHeight();
  if (Platform.OS !== 'web') return undefined;
  return height - TOPNAV_HEIGHT - chrome;
}

export function BoardScreen({ pane }: { pane: boolean }): React.ReactElement {
  const [query, setQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  const height = useBoardHeight();
  const windowHeight = !pane && height !== undefined;
  return (
    <Col flex={windowHeight ? undefined : 1} height={windowHeight ? height : undefined} surface="surface">
      <BoardFrame pane={pane} query={query} setQuery={setQuery} onFilterMenu={setFiltering}>
        <BoardBody query={query} filtering={filtering}/>
      </BoardFrame>
    </Col>
  );
}
