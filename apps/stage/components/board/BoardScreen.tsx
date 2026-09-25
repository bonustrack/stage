import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge } from '@stage-labs/kit/react-native/badge';
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
import {
  BOARD_GAP, UNLABELED_TITLE, boardColumnWidth, boardColumns, type BoardColumn,
} from './BoardScreen.model';

const COLUMN_PADDING = 10;
const CARD_GAP = 8;

function BoardCard({ item, pinned }: { item: ChannelRowData; pinned: boolean }): React.ReactElement {
  const router = useRouter();
  const { border } = usePalette();
  const isGroup = !item.peerAddress;
  const draftText = getDraft(item.convId);
  return (
    <Box surface="surface" radius={BLOCK_RADIUS_DEFAULT} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
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
  if (label === null) return <Text value={UNLABELED_TITLE} size="lg" weight="semibold" truncate/>;
  return <LabelText label={label} size="lg" weight="semibold" truncate/>;
}

function BoardColumnView({ column, width, pinned }: {
  column: BoardColumn<ChannelRowData>; width: number | null; pinned: readonly string[];
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Col
      surface="toolbar"
      radius={BLOCK_RADIUS_DEFAULT}
      padding={COLUMN_PADDING}
      gap={CARD_GAP}
      width={width ?? undefined}
      flex={width === null ? 1 : undefined}
      style={{ borderWidth: 1, borderColor: border }}
    >
      <Row align="center" gap={8} padding={{ x: 4, y: 2 }}>
        <ColumnTitle label={column.label}/>
        <Badge label={String(column.rows.length)} color="secondary" variant="soft" pill/>
      </Row>
      {column.rows.map(item => (
        <BoardCard key={item.convId} item={item} pinned={pinned.includes(item.convId)}/>
      ))}
    </Col>
  );
}

function BoardColumns({ columns, pinned }: {
  columns: BoardColumn<ChannelRowData>[]; pinned: readonly string[];
}): React.ReactElement {
  const [available, setAvailable] = useState(0);
  const width = boardColumnWidth(available, columns.length);
  return (
    <Row
      wrap
      align="start"
      gap={BOARD_GAP}
      padding={{ x: PAGE_GUTTER, y: LIST_TOP_GAP }}
      onLayout={(e) => { setAvailable(e.nativeEvent.layout.width - 2 * PAGE_GUTTER); }}
    >
      {columns.map(column => (
        <BoardColumnView key={column.key} column={column} width={width} pinned={pinned}/>
      ))}
    </Row>
  );
}

function BoardBody(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const pinned = usePinnedOrder();
  const cleared = useClearedChats();
  const [error, setError] = useState<string>('');
  useChannelsSync({ accountEpoch: useActiveAccount(), setError });
  usePeerProfiles((rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]));
  useDraftsVersion();
  const columns = useMemo(
    () => boardColumns((rows ?? []).filter(r => !isRowCleared(cleared, r)), pinned),
    [rows, cleared, pinned],
  );
  if (error) return <HomeError error={error} dark={dark} fg={fg}/>;
  if (!rows) return <HomeSpinner head={head}/>;
  if (columns.length === 0) return <EmptyState title="No channels yet"/>;
  return <BoardColumns columns={columns} pinned={pinned}/>;
}

export function BoardScreen(): React.ReactElement {
  return (
    <Col flex={1} surface="surface">
      <StackHeader title="Board" backTo="/"/>
      <BoardBody/>
    </Col>
  );
}
