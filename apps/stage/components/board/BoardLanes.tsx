import { useEffect, useRef, useState } from 'react';
import { Platform, type DimensionValue } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { List } from '@stage-labs/kit/react-native/list';
import { SortableHandle, SortableItem, SortableList, SortableScope } from '@stage-labs/kit/react-native/sortable';
import { moveAnchor, type SortMove } from '@stage-labs/kit/sortable';
import { CountTag } from '../CountTag';
import { NewChatAction } from '../home/NewChatAction';
import type { Row as ChannelRowData } from '../home/model';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useHomeView } from '../../lib/homeView';
import { useWebTabRail } from '../../lib/webLayout';
import { channelRouteConvId } from '../tabs/splitRoutes';
import {
  BOARD_GAP,
  acceptsCardMove,
  acceptsColumnMove,
  activeColumnIndex,
  columnEditable,
  columnMovable,
  revealScrollX,
  type BoardColumn,
} from './BoardScreen.model';
import { revealMarked, useArrowKeys } from '../arrowKeys';
import { ALL_ARROWS } from '../arrowKeys.model';
import { boardArrowMove } from './boardKeys.model';
import { AddColumn, ColumnFrame, ColumnMenu, ColumnTitle, HEADER_PADDING, RenameHeading } from './BoardColumnEdit';
import { ColumnCards, cardDataSet, showInPanel } from './BoardCard';
import { Column, Row, LIST_TOP_GAP, PAGE_GUTTER, SELF_SCROLLBAR } from '../layout';

const GROW = { flexGrow: 1, flexShrink: 1 };
const SHRINK = { flexShrink: 1, minHeight: 0 };
const LANE = { alignSelf: 'stretch', alignItems: 'flex-start' } as const;
const FILL = { flex: 1 };

export interface ColumnActions {
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

function BoardColumnView({
  column,
  columns,
  maxHeight,
  pinned,
  actions,
  onOpen,
}: {
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
      label={label}
      columns={columns}
      count={column.rows.length}
      onRename={actions.rename}
      onClose={() => {
        setEditing(false);
      }}
    />
  ) : (
    <Row align="center" gap={8} padding={{ right: HEADER_PADDING.right }}>
      <SortableHandle style={GROW}>
        <Row align="center" gap={8} padding={{ left: HEADER_PADDING.left, y: HEADER_PADDING.y }}>
          <ColumnTitle
            label={label}
            onPress={
              editable
                ? () => {
                    setEditing(true);
                  }
                : undefined
            }
          />
          <CountTag count={column.rows.length} />
          <Column weight={1} />
        </Row>
      </SortableHandle>
      {editable ? (
        <ColumnMenu
          onDelete={() => {
            actions.remove(label);
          }}
        />
      ) : null}
      <NewChatAction by={columnBy} groupKey={column.key} title={label} />
    </Row>
  );
  return (
    <SortableItem
      itemId={column.key}
      handle
      disabled={editing || !columnMovable(column.key)}
      style={maxHeight === undefined ? undefined : { maxHeight }}
    >
      <SortableList
        listId={column.key}
        group="cards"
        itemIds={column.rows.map((row) => row.convId)}
        keyboard={false}
        style={SHRINK}
        accepts={acceptsCardMove}
        placeAt={actions.placeCard}
        onMove={(move) => {
          actions.dropCard(move.itemId, move.fromListId, column.key);
        }}
      >
        {({ over, placeholder }) => (
          <ColumnFrame over={over} shrink>
            {heading}
            <ColumnCards column={column} pinned={pinned} editable={actions.editable} placeholder={placeholder} onOpen={onOpen} />
          </ColumnFrame>
        )}
      </SortableList>
    </SortableItem>
  );
}

function useCardArrows({
  columns,
  openIndex,
  openConvId,
  paused,
  onMove,
}: {
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

function LaneColumns({
  columns,
  pinned,
  laneHeight,
  actions,
  onOpen,
}: {
  columns: BoardColumn<ChannelRowData>[];
  pinned: readonly string[];
  laneHeight: number;
  actions: ColumnActions;
  onOpen: (key: string) => void;
}): React.ReactElement {
  return (
    <SortableList
      listId="board-columns"
      group="columns"
      direction="horizontal"
      gap={BOARD_GAP}
      keyboard={false}
      style={LANE}
      itemIds={columns.map((column) => column.key)}
      accepts={acceptsColumnMove}
      onMove={(move) => {
        const target = moveAnchor(move);
        if (target !== null) actions.dropColumn(move.itemId, target);
      }}
    >
      {columns.map((column) => (
        <BoardColumnView
          key={column.key}
          column={column}
          columns={columns}
          pinned={pinned}
          maxHeight={columnMaxHeight(laneHeight)}
          actions={actions}
          onOpen={onOpen}
        />
      ))}
    </SortableList>
  );
}

export function BoardLanes({
  columns,
  pinned,
  actions,
  filtering,
}: {
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
  useEffect(() => {
    revealColumn(openIndex);
  }, [openIndex, frame.width]);
  useCardArrows({
    columns,
    openIndex,
    openConvId,
    paused: filtering,
    onMove: (key) => {
      setOpenedFrom(key);
      revealColumn(columns.findIndex((column) => column.key === key));
    },
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
        onLayout={(e) => {
          setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
        }}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={revealEnd}
      >
        <LaneColumns columns={columns} pinned={pinned} laneHeight={laneHeight} actions={actions} onOpen={setOpenedFrom} />
        {actions.editable ? (
          <AddColumn
            columns={columns}
            onAdd={actions.create}
            onReveal={() => {
              reveal.current = true;
            }}
          />
        ) : null}
      </List>
    </SortableScope>
  );
}
