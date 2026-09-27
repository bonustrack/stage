import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, Row, LIST_TOP_GAP, PAGE_GUTTER } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { HomeTopnavRight } from '../home/topnavRight';
import { ChannelRow } from '../ChannelRow';
import { LabelText } from '../LabelText';
import { CountTag } from '../CountTag';
import { HomeError, HomeSpinner, RowChannelMenu, rowMenuOpener, rowPreview, rowTitle } from '../home/parts';
import { homeRows, type RowMenu } from '../home/state';
import { useChannelsSync } from '../home/sync';
import type { Row as ChannelRowData } from '../home/model';
import { lineOfConv, prefetchFeed, subscribeCachedRows, useActiveAccount } from '../../modules/messaging';
import { useStoreValue } from '../../lib/storeCore';
import { usePinnedOrder } from '../../lib/pins';
import { useClearedChats } from '../../lib/clearedChats';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { conversationLinkOf } from '../../lib/links';
import { channelTimestamp } from '../../lib/format';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { reported } from '../../lib/errorPolicy';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useBoardOrder } from '../../lib/boardOrder';
import { capabilities } from '../../lib/capabilities';
import { useWebTabRail } from '../../lib/webLayout';
import { boardPanelConvId } from '../tabs/splitRoutes';
import {
  BOARD_GAP, activeColumnIndex, boardCardPress, boardColumns, orderedColumns, revealScrollX, searchedColumns,
  type BoardColumn, type BoardDrag,
} from './BoardScreen.model';
import { useBoardDragSource, useBoardDropZone } from './boardDrag';
import { revealMarked, useArrowKeys } from '../arrowKeys';
import { ALL_ARROWS, type MarkedNode } from '../arrowKeys.model';
import { boardArrowMove } from './boardKeys.model';
import { addToBoardLabel, deleteBoardLabel, dropOnBoard, renameBoardLabel } from './boardActions';
import { AddItemButton, AddItemModal } from './BoardAddItem';
import {
  AddColumn, CARD_GAP, COLUMN_PADDING, ColumnFrame, ColumnMenu, HEADER_PADDING, RenameHeading, TITLE_SIZE,
} from './BoardColumnEdit';

const DRAGGING_OPACITY = 0.4;
const BOARD_SCROLLBAR = { dataSet: { stagescrollbar: '1' } };

type BoardRouter = ReturnType<typeof useRouter>;

const cardDataSet = (columnKey: string, convId: string): MarkedNode => (
  { dataSet: { boardcard: convId, boardcolumn: columnKey } }
);

function showInPanel(router: BoardRouter, convId: string, press: 'push' | 'replace'): void {
  const panelLink = { pathname: '/board/[convId]', params: { convId } } as const;
  if (press === 'push') router.push(panelLink);
  else router.replace(panelLink);
}

interface ColumnActions {
  drop: (drag: BoardDrag, key: string) => void;
  rename: (from: string, to: string) => void;
  remove: (label: string) => void;
  add: (label: string) => void;
}

function columnMaxHeight(laneHeight: number): number | string | undefined {
  if (Platform.OS === 'web') return '100%';
  return laneHeight > 0 ? laneHeight : undefined;
}

function BoardCard({ item, pinned, columnKey, onOpen }: {
  item: ChannelRowData; pinned: boolean; columnKey: string; onOpen: () => void;
}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const panel = useWebTabRail();
  const { border, link } = usePalette();
  const openConvId = boardPanelConvId(pathname);
  const isGroup = !item.peerAddress;
  const draftText = getDraft(item.convId);
  const source = useBoardDragSource(isGroup ? { kind: 'card', convId: item.convId, from: columnKey } : null);
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const openMenu = rowMenuOpener(item, setMenu);
  return (
    <Box
      {...cardDataSet(columnKey, item.convId)}
      nativeID={source.nativeID}
      background={border}
      radius={BLOCK_RADIUS_DEFAULT}
      style={{
        overflow: 'hidden', opacity: source.dragging ? DRAGGING_OPACITY : 1,
        borderWidth: 1, borderColor: panel && openConvId === item.convId ? link : border,
      }}
    >
      <ChannelRow
        title={rowTitle(item)}
        hideAvatar
        wrapTitle
        lastPreview={rowPreview(item)}
        timestamp={channelTimestamp(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={pinned}
        hasDraft={draftText.trim().length > 0}
        draftText={draftText}
        onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
        onPress={() => {
          if (!panel) {
            router.push(conversationLinkOf(item.convId, item.peerAddress));
            return;
          }
          const press = boardCardPress(openConvId, item.convId);
          if (press === 'close') {
            capabilities.backTo('/board');
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

function ColumnTitle({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Rename column" style={{ flexShrink: 1 }}>
      <LabelText label={label} size={TITLE_SIZE} weight="semibold" truncate/>
    </Pressable>
  );
}

function ColumnCards({ column, pinned, onOpen }: {
  column: BoardColumn<ChannelRowData>; pinned: readonly string[]; onOpen: (key: string) => void;
}): React.ReactElement | null {
  if (column.rows.length === 0) return null;
  return (
    <Scroll
      {...BOARD_SCROLLBAR}
      gap={CARD_GAP}
      nestedScrollEnabled
      style={{ flexGrow: 0, flexShrink: 1 }}
      contentContainerStyle={{ paddingRight: COLUMN_PADDING }}
    >
      {column.rows.map(item => (
        <BoardCard
          key={item.convId} item={item} pinned={pinned.includes(item.convId)} columnKey={column.key}
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
  const [editing, setEditing] = useState(false);
  const zone = useBoardDropZone(column.key, (drag) => { actions.drop(drag, column.key); });
  const handle = useBoardDragSource(editing ? null : { kind: 'column', key: column.key }, zone.nativeID);
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
            <ColumnTitle label={label} onPress={() => { setEditing(true); }}/>
            <CountTag count={column.rows.length}/>
            <Box flex={1}/>
          </Row>
          <ColumnMenu onDelete={() => { actions.remove(label); }}/>
        </Row>
      )}
      <ColumnCards column={column} pinned={pinned} onOpen={onOpen}/>
      <AddItemButton onPress={() => { actions.add(label); }}/>
    </ColumnFrame>
  );
}

function useCardArrows({ columns, openIndex, openConvId, onMove }: {
  columns: readonly BoardColumn<ChannelRowData>[];
  openIndex: number;
  openConvId: string | null;
  onMove: (key: string) => void;
}): void {
  const router = useRouter();
  useArrowKeys(useWebTabRail() && openConvId !== null, ALL_ARROWS, (arrow) => {
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

function BoardLanes({ columns, pinned, saved, actions }: {
  columns: BoardColumn<ChannelRowData>[];
  pinned: readonly string[];
  saved: readonly string[];
  actions: ColumnActions;
}): React.ReactElement {
  const { bottom } = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const scroll = useRef<React.ComponentRef<typeof Scroll>>(null);
  const scrollX = useRef(0);
  const reveal = useRef(false);
  const padding = { paddingHorizontal: PAGE_GUTTER, paddingTop: LIST_TOP_GAP, paddingBottom: LIST_TOP_GAP + bottom };
  const laneHeight = frame.height - padding.paddingTop - padding.paddingBottom;
  const [openedFrom, setOpenedFrom] = useState<string | null>(null);
  const openConvId = boardPanelConvId(usePathname());
  const openIndex = activeColumnIndex(columns, openConvId, openedFrom);
  const revealColumn = (index: number): void => {
    if (index === -1 || frame.width === 0) return;
    const x = revealScrollX(index, scrollX.current, frame.width, PAGE_GUTTER);
    if (x !== scrollX.current) scroll.current?.scrollTo({ x, animated: true });
  };
  useEffect(() => { revealColumn(openIndex); }, [openIndex, frame.width]);
  useCardArrows({
    columns, openIndex, openConvId,
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
      {...BOARD_SCROLLBAR}
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
          column={column}
          columns={columns}
          maxHeight={columnMaxHeight(laneHeight)}
          pinned={pinned}
          actions={actions}
          onOpen={setOpenedFrom}
        />
      ))}
      <AddColumn columns={columns} saved={saved} onReveal={() => { reveal.current = true; }}/>
    </Scroll>
  );
}

function BoardBody({ query }: { query: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const pinned = usePinnedOrder();
  const cleared = useClearedChats();
  const order = useBoardOrder();
  const [error, setError] = useState<string>('');
  const [adding, setAdding] = useState<string | null>(null);
  useChannelsSync({ accountEpoch: useActiveAccount(), setError });
  usePeerProfiles((rows ?? []).map(r => r.lastSenderAddress));
  useDraftsVersion();
  const columns = useMemo(
    () => orderedColumns(boardColumns(rows ?? [], pinned, order, r => isRowCleared(cleared, r)), order),
    [rows, cleared, pinned, order],
  );
  const shown = useMemo(() => searchedColumns(columns, query), [columns, query]);
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  const actions: ColumnActions = {
    drop: (drag, key) => { dropOnBoard(columns, order, drag, key); },
    rename: (from, to) => { void renameBoardLabel(rows, columns, order, from, to).catch(reported('board.rename')); },
    remove: (label) => { void deleteBoardLabel(rows, columns, order, label).catch(reported('board.delete')); },
    add: setAdding,
  };
  const addPicked = (convIds: string[]): void => {
    setAdding(null);
    if (adding !== null) void addToBoardLabel(convIds, adding).catch(reported('board.add'));
  };
  return (
    <>
      <BoardLanes columns={shown} pinned={pinned} saved={order} actions={actions}/>
      <AddItemModal label={adding} rows={rows} onClose={() => { setAdding(null); }} onAdd={addPicked}/>
    </>
  );
}

function BoardHeader({ inline, query, setQuery }: {
  inline: boolean; query: string; setQuery: (query: string) => void;
}): React.ReactElement {
  const { text, link, border } = usePalette();
  const safeTop = useSafeAreaInsets().top;
  const [searchOpen, setSearchOpen] = useState(false);
  if (searchOpen) {
    return (
      <SearchTopnavBar
        query={query} setQuery={setQuery} onClose={() => { setSearchOpen(false); setQuery(''); }}
        head={link} sub={text} border={border} inline={inline} topInset={inline ? 0 : safeTop}
        trailing={<HomeTopnavRight head={text} onOpenSearch={() => { setSearchOpen(true); }} view="board"/>}
      />
    );
  }
  const trailing = (
    <>
      <Box flex={1}/>
      <Row align="center" gap={18}>
        <HomeTopnavRight head={text} onOpenSearch={() => { setSearchOpen(true); }} view="board"/>
      </Row>
    </>
  );
  return <StackHeader title="Board" backTo="/" inline={inline} trailing={trailing}/>;
}

export function BoardScreen({ pane }: { pane?: boolean } = {}): React.ReactElement | null {
  const { height } = useWindowDimensions();
  const docked = useWebTabRail();
  const [query, setQuery] = useState('');
  const windowHeight = Platform.OS === 'web' && pane !== true;
  if (docked && pane !== true) return null;
  return (
    <Col flex={windowHeight ? undefined : 1} height={windowHeight ? height : undefined} surface="surface">
      <BoardHeader inline={pane === true} query={query} setQuery={setQuery}/>
      <BoardBody query={query}/>
    </Col>
  );
}
