import { useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, Row, LIST_TOP_GAP, PAGE_GUTTER } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../ChannelRow';
import { LabelText } from '../LabelText';
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
import {
  BOARD_GAP, UNLABELED_TITLE, boardColumns, orderedColumns, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';
import { useBoardDragSource, useBoardDropZone } from './boardDrag';
import { dropOnBoard, renameBoardLabel } from './boardActions';
import {
  AddColumn, CARD_GAP, COLUMN_PADDING, ColumnFrame, HEADER_PADDING, RenameHeading, TITLE_SIZE,
} from './BoardColumnEdit';

const DRAGGING_OPACITY = 0.4;

type OnBoardDrop = (drag: BoardDrag, key: string) => void;
type OnRename = (from: string, to: string) => void;

function columnMaxHeight(laneHeight: number): number | string | undefined {
  if (Platform.OS === 'web') return '100%';
  return laneHeight > 0 ? laneHeight : undefined;
}

function BoardCard({ item, pinned, columnKey }: {
  item: ChannelRowData; pinned: boolean; columnKey: string;
}): React.ReactElement {
  const router = useRouter();
  const { border } = usePalette();
  const isGroup = !item.peerAddress;
  const draftText = getDraft(item.convId);
  const source = useBoardDragSource(isGroup ? { kind: 'card', convId: item.convId, from: columnKey } : null);
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const openMenu = rowMenuOpener(item, setMenu);
  return (
    <Box
      nativeID={source.nativeID}
      background={border}
      radius={BLOCK_RADIUS_DEFAULT}
      style={{ overflow: 'hidden', opacity: source.dragging ? DRAGGING_OPACITY : 1 }}
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
        onPress={() => { router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
        onLongPress={source.nativeID === undefined ? openMenu : undefined}
        onContextMenu={openMenu}
      />
      <RowChannelMenu menu={menu} isPinned={pinned} onClose={() => { setMenu(null); }}/>
    </Box>
  );
}

function ColumnTitle({ label, onPress }: { label: string | null; onPress: () => void }): React.ReactElement {
  if (label === null) return <Text value={UNLABELED_TITLE} size={TITLE_SIZE} weight="semibold" truncate/>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Rename column" style={{ flexShrink: 1 }}>
      <LabelText label={label} size={TITLE_SIZE} weight="semibold" truncate/>
    </Pressable>
  );
}

function EmptyColumn(): React.ReactElement {
  return (
    <Col align="center" padding={{ y: PAGE_GUTTER, right: COLUMN_PADDING }}>
      <Text value="No channels" size="sm" role="secondary" textAlign="center"/>
    </Col>
  );
}

function ColumnCards({ column, pinned }: {
  column: BoardColumn<ChannelRowData>; pinned: readonly string[];
}): React.ReactElement {
  if (column.rows.length === 0) return <EmptyColumn/>;
  return (
    <Scroll
      gap={CARD_GAP}
      nestedScrollEnabled
      style={{ flexGrow: 0, flexShrink: 1 }}
      contentContainerStyle={{ paddingRight: COLUMN_PADDING }}
    >
      {column.rows.map(item => (
        <BoardCard key={item.convId} item={item} pinned={pinned.includes(item.convId)} columnKey={column.key}/>
      ))}
    </Scroll>
  );
}

function BoardColumnView({ column, columns, maxHeight, pinned, onDrop, onRename }: {
  column: BoardColumn<ChannelRowData>;
  columns: readonly BoardColumn<ChannelRowData>[];
  maxHeight?: number | string;
  pinned: readonly string[];
  onDrop: OnBoardDrop;
  onRename: OnRename;
}): React.ReactElement {
  const { label } = column;
  const [editing, setEditing] = useState(false);
  const zone = useBoardDropZone(column.key, (drag) => { onDrop(drag, column.key); });
  const handle = useBoardDragSource(editing ? null : { kind: 'column', key: column.key }, zone.nativeID);
  return (
    <ColumnFrame
      nativeID={zone.nativeID} over={zone.over} opacity={handle.dragging ? DRAGGING_OPACITY : 1} maxHeight={maxHeight}
    >
      {label !== null && editing ? (
        <RenameHeading
          label={label} columns={columns} count={column.rows.length} onRename={onRename}
          onClose={() => { setEditing(false); }}
        />
      ) : (
        <Row nativeID={handle.nativeID} align="center" gap={8} padding={HEADER_PADDING}>
          <ColumnTitle label={label} onPress={() => { setEditing(true); }}/>
          <Badge label={String(column.rows.length)} color="secondary" variant="soft" pill/>
          <Box flex={1}/>
        </Row>
      )}
      <ColumnCards column={column} pinned={pinned}/>
    </ColumnFrame>
  );
}

function BoardLanes({ columns, pinned, saved, onDrop, onRename }: {
  columns: BoardColumn<ChannelRowData>[];
  pinned: readonly string[];
  saved: readonly string[];
  onDrop: OnBoardDrop;
  onRename: OnRename;
}): React.ReactElement {
  const { bottom } = useSafeAreaInsets();
  const [frame, setFrame] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof Scroll>>(null);
  const reveal = useRef(false);
  const padding = { paddingHorizontal: PAGE_GUTTER, paddingTop: LIST_TOP_GAP, paddingBottom: LIST_TOP_GAP + bottom };
  const laneHeight = frame - padding.paddingTop - padding.paddingBottom;
  const revealEnd = (): void => {
    if (!reveal.current) return;
    reveal.current = false;
    scroll.current?.scrollToEnd({ animated: true });
  };
  return (
    <Scroll
      ref={scroll}
      horizontal
      gap={BOARD_GAP}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={{ ...padding, alignItems: 'flex-start' }}
      onLayout={(e) => { setFrame(e.nativeEvent.layout.height); }}
      onContentSizeChange={revealEnd}
    >
      {columns.map(column => (
        <BoardColumnView
          key={column.key}
          column={column}
          columns={columns}
          maxHeight={columnMaxHeight(laneHeight)}
          pinned={pinned}
          onDrop={onDrop}
          onRename={onRename}
        />
      ))}
      <AddColumn columns={columns} saved={saved} onReveal={() => { reveal.current = true; }}/>
    </Scroll>
  );
}

function BoardBody(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const pinned = usePinnedOrder();
  const cleared = useClearedChats();
  const order = useBoardOrder();
  const [error, setError] = useState<string>('');
  useChannelsSync({ accountEpoch: useActiveAccount(), setError });
  usePeerProfiles((rows ?? []).map(r => r.lastSenderAddress));
  useDraftsVersion();
  const columns = useMemo(
    () => orderedColumns(boardColumns(rows ?? [], pinned, order, r => isRowCleared(cleared, r)), order),
    [rows, cleared, pinned, order],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  if (columns.length === 0) return <EmptyState title="No channels yet"/>;
  const onDrop: OnBoardDrop = (drag, key) => { dropOnBoard(columns, order, drag, key); };
  const onRename: OnRename = (from, to) => {
    void renameBoardLabel(rows, columns, order, from, to).catch(reported('board.rename'));
  };
  return <BoardLanes columns={columns} pinned={pinned} saved={order} onDrop={onDrop} onRename={onRename}/>;
}

export function BoardScreen(): React.ReactElement {
  const { height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  return (
    <Col flex={web ? undefined : 1} height={web ? height : undefined} surface="surface">
      <StackHeader title="Board" backTo="/"/>
      <BoardBody/>
    </Col>
  );
}
