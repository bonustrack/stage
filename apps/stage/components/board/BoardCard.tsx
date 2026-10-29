import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { List } from '@stage-labs/kit/react-native/list';
import { SortableItem } from '@stage-labs/kit/react-native/sortable';
import { ChannelRow } from '../ChannelRow';
import { ChannelRowFields } from '../ChannelRowFields';
import { useChannelFields } from '../../lib/channelFields';
import { RowChannelMenu, rowAvatarAddress, rowMenuOpener, rowPreview, rowTitle } from '../home/parts';
import type { RowMenu } from '../home/state';
import type { Row as ChannelRowData } from '../home/model';
import { prefetchFeed } from '../../modules/messaging/feedQuery';
import { getDraft } from '../../lib/drafts';
import { conversationLinkOf } from '../../lib/links';
import { channelTimestamp } from '../../lib/format';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useWebTabRail } from '../../lib/webLayout';
import { BOARD_ROUTE, channelRouteConvId } from '../tabs/splitRoutes';
import { boardCardPress, cardsRightPadding, type BoardColumn } from './BoardScreen.model';
import type { MarkedNode } from '../arrowKeys.model';
import { CARD_GAP, COLUMN_PADDING } from './BoardColumnEdit';
import { Column, GUTTER_SCROLLBAR, gutterScrollbarWidth } from '../layout';

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
  item: ChannelRowData;
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
  const openMenu = rowMenuOpener(item, setMenu);
  const title = rowTitle(item);
  return (
    <SortableItem itemId={item.convId} disabled={!editable} onHold={openMenu}>
      <Column
        {...cardDataSet(columnKey, item.convId)}
        surface="surface"
        radius={BLOCK_RADIUS_DEFAULT}
        style={{ overflow: 'hidden', borderWidth: 1, borderColor: (panel && openConvId === item.convId) || menu !== null ? link : bg }}
      >
        <ChannelRow
          title={title.text}
          placeholderTitle={title.placeholder}
          avatarUri={item.avatarUri}
          avatarAddress={rowAvatarAddress(item)}
          square={!item.peerAddress}
          hideAvatar={!fields.avatar}
          wrapTitle
          lastPreview={rowPreview(item)}
          showPreview={fields.lastMessage}
          timestamp={channelTimestamp(item.lastTs)}
          unreadCount={item.unreadCount}
          markedUnread={item.markedUnread}
          pinned={pinned}
          draftText={draftText}
          fields={<ChannelRowFields data={item} fields={fields} />}
          onPressIn={() => {
            prefetchFeed(lineOfConv(item.convId));
          }}
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
        <RowChannelMenu
          menu={menu}
          isPinned={pinned}
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
  column: BoardColumn<ChannelRowData>;
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
