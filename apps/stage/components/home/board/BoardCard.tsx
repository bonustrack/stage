import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { List } from '@stage-labs/kit/react-native/list';
import { SortableItem } from '@stage-labs/kit/react-native/sortable';
import { ChannelRow } from '../../chatRow/ChannelRow';
import { RowChannelMenu, chatRowProps, rowMenuOpener, type RowMenu } from '../../chatRow/chatRow';
import { useChannelFields } from '../../../lib/channelFields';
import type { CachedRow } from '../../../lib/cachedRows.model';
import { getDraft } from '../../../lib/drafts';
import { conversationLinkOf } from '../../../lib/links';
import { usePalette } from '../../../lib/theme';
import { capabilities } from '../../../lib/capabilities';
import { useWebTabRail } from '../../layout/webLayout';
import { channelRouteConvId } from '../../tabs/splitRoutes';
import { PAGES } from '../../tabs/pages';
import { boardCardPress, cardsRightPadding, type BoardColumn } from './BoardScreen.model';
import type { MarkedNode } from '../../keys/keys.model';
import { CARD_GAP, COLUMN_PADDING } from './BoardColumnEdit';
import { Column, GUTTER_SCROLLBAR, gutterScrollbarWidth } from '../../layout';

type BoardRouter = ReturnType<typeof useRouter>;
export const cardDataSet = (columnKey: string, convId: string): MarkedNode => ({ dataSet: { boardcard: convId, boardcolumn: columnKey } });

export function showInPanel(router: BoardRouter, convId: string, press: 'push' | 'replace'): void {
  const link = conversationLinkOf(convId, null);
  if (press === 'push') router.push(link);
  else router.replace(link);
}

function BoardCard({
  item,
  pinned,
  columnKey,
  editable,
  onOpen,
}: {
  item: CachedRow;
  pinned: boolean;
  columnKey: string;
  editable: boolean;
  onOpen: () => void;
}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const panel = useWebTabRail();
  const { bg, link } = usePalette();
  const openConvId = channelRouteConvId(pathname);
  const draftText = getDraft(item.convId);
  const fields = useChannelFields('board');
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const openMenu = rowMenuOpener(item.convId, setMenu);
  return (
    <SortableItem itemId={item.convId} disabled={!editable} onHold={openMenu}>
      <Column
        {...cardDataSet(columnKey, item.convId)}
        surface="surface"
        radius={BLOCK_RADIUS_DEFAULT}
        style={{ overflow: 'hidden', borderWidth: 1, borderColor: (panel && openConvId === item.convId) || menu !== null ? link : bg }}
      >
        <ChannelRow
          {...chatRowProps(item, { pinned, fields, draftText })}
          wrapTitle
          onPress={() => {
            if (!panel) {
              router.push(conversationLinkOf(item.convId, item.peerAddress));
              return;
            }
            const press = boardCardPress(openConvId, item.convId);
            if (press === 'close') {
              capabilities.backTo(PAGES.board.href);
              return;
            }
            onOpen();
            showInPanel(router, item.convId, press);
          }}
          onLongPress={editable ? undefined : openMenu}
          onContextMenu={openMenu}
        />
        <RowChannelMenu
          menu={menu}
          onClose={() => {
            setMenu(null);
          }}
        />
      </Column>
    </SortableItem>
  );
}

export function ColumnCards({
  column,
  pinned,
  editable,
  placeholder,
  onOpen,
}: {
  column: BoardColumn<CachedRow>;
  pinned: readonly string[];
  editable: boolean;
  placeholder: React.ReactNode;
  onOpen: (key: string) => void;
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
      {column.rows.map((item) => (
        <BoardCard
          key={item.convId}
          item={item}
          pinned={pinned.includes(item.convId)}
          columnKey={column.key}
          editable={editable}
          onOpen={() => {
            onOpen(column.key);
          }}
        />
      ))}
      {placeholder}
    </List>
  );
}
