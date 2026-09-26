import { useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { Button } from '@stage-labs/kit/react-native/button';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, Row, LIST_TOP_GAP, PAGE_GUTTER } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../ChannelRow';
import { LabelText } from '../LabelText';
import { HomeError, HomeSpinner, rowAvatarAddress, rowPreview, rowTitle } from '../home/parts';
import { homeRows } from '../home/state';
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
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useBoardOrder } from '../../lib/boardOrder';
import {
  BOARD_COLUMN_WIDTH, BOARD_GAP, UNLABELED_TITLE, boardColumns, orderedColumns, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';
import { useBoardDragSource, useBoardDropZone } from './boardDrag';
import { dropOnBoard, removeBoardColumn } from './boardActions';

const COLUMN_PADDING = 10;
const CARD_GAP = 8;
const TITLE_SIZE = '2xl';
const DRAGGING_OPACITY = 0.4;

type OnBoardDrop = (drag: BoardDrag, key: string) => void;

interface ColumnActions {
  onDrop: OnBoardDrop;
  onRemove: (key: string) => void;
}

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
  return (
    <Box
      nativeID={source.nativeID}
      background={border}
      radius={BLOCK_RADIUS_DEFAULT}
      style={{ overflow: 'hidden', opacity: source.dragging ? DRAGGING_OPACITY : 1 }}
    >
      <ChannelRow
        title={rowTitle(item)}
        avatarUri={item.avatarUri}
        avatarAddress={rowAvatarAddress(item, isGroup)}
        square={isGroup}
        lastPreview={rowPreview(item)}
        timestamp={channelTimestamp(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={pinned}
        hasDraft={draftText.trim().length > 0}
        draftText={draftText}
        onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
        onPress={() => { router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
      />
    </Box>
  );
}

function ColumnTitle({ label }: { label: string | null }): React.ReactElement {
  if (label === null) return <Text value={UNLABELED_TITLE} size={TITLE_SIZE} weight="semibold" truncate/>;
  return <LabelText label={label} size={TITLE_SIZE} weight="semibold" truncate/>;
}

function EmptyColumn({ removable, onRemove }: { removable: boolean; onRemove: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col align="center" gap={8} padding={{ y: PAGE_GUTTER, right: COLUMN_PADDING }}>
      <Text value="No channels" size="sm" role="secondary" textAlign="center"/>
      {removable
        ? <Button color="secondary" variant="ghost" size="sm" dark={dark} label="Remove column" onPress={onRemove}/>
        : null}
    </Col>
  );
}

function ColumnCards({ column, pinned, onRemove }: {
  column: BoardColumn<ChannelRowData>; pinned: readonly string[]; onRemove: () => void;
}): React.ReactElement {
  if (column.rows.length === 0) return <EmptyColumn removable={column.removable} onRemove={onRemove}/>;
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

function BoardColumnView({ column, maxHeight, pinned, actions }: {
  column: BoardColumn<ChannelRowData>;
  maxHeight?: number | string;
  pinned: readonly string[];
  actions: ColumnActions;
}): React.ReactElement {
  const { border, link } = usePalette();
  const zone = useBoardDropZone(column.key, (drag) => { actions.onDrop(drag, column.key); });
  const handle = useBoardDragSource({ kind: 'column', key: column.key }, zone.nativeID);
  return (
    <Col
      nativeID={zone.nativeID}
      surface="toolbar"
      radius={BLOCK_RADIUS_DEFAULT}
      padding={{ top: COLUMN_PADDING, bottom: COLUMN_PADDING, left: COLUMN_PADDING }}
      gap={CARD_GAP}
      width={BOARD_COLUMN_WIDTH}
      maxHeight={maxHeight}
      style={{ borderWidth: 1, borderColor: zone.over ? link : border, opacity: handle.dragging ? DRAGGING_OPACITY : 1 }}
    >
      <Row nativeID={handle.nativeID} align="center" gap={8} padding={{ left: 4, right: 4 + COLUMN_PADDING, y: 2 }}>
        <ColumnTitle label={column.label}/>
        <Badge label={String(column.rows.length)} color="secondary" variant="soft" pill/>
      </Row>
      <ColumnCards column={column} pinned={pinned} onRemove={() => { actions.onRemove(column.key); }}/>
    </Col>
  );
}

function BoardLanes({ columns, pinned, actions }: {
  columns: BoardColumn<ChannelRowData>[]; pinned: readonly string[]; actions: ColumnActions;
}): React.ReactElement {
  const { bottom } = useSafeAreaInsets();
  const [frame, setFrame] = useState(0);
  const padding = { paddingHorizontal: PAGE_GUTTER, paddingTop: LIST_TOP_GAP, paddingBottom: LIST_TOP_GAP + bottom };
  const laneHeight = frame - padding.paddingTop - padding.paddingBottom;
  return (
    <Scroll
      horizontal
      gap={BOARD_GAP}
      style={{ flex: 1 }}
      contentContainerStyle={{ ...padding, alignItems: 'flex-start' }}
      onLayout={(e) => { setFrame(e.nativeEvent.layout.height); }}
    >
      {columns.map(column => (
        <BoardColumnView
          key={column.key}
          column={column}
          maxHeight={columnMaxHeight(laneHeight)}
          pinned={pinned}
          actions={actions}
        />
      ))}
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
  usePeerProfiles((rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]));
  useDraftsVersion();
  const columns = useMemo(
    () => orderedColumns(boardColumns(rows ?? [], pinned, order, r => isRowCleared(cleared, r)), order),
    [rows, cleared, pinned, order],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  if (columns.length === 0) return <EmptyState title="No channels yet"/>;
  const actions: ColumnActions = {
    onDrop: (drag, key) => { dropOnBoard(columns, order, drag, key); },
    onRemove: (key) => { removeBoardColumn(order, key); },
  };
  return <BoardLanes columns={columns} pinned={pinned} actions={actions}/>;
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
