import { conversationLinkOf, isActiveConversationPath } from '../../lib/links';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { prefetchFeed } from '../../lib/feed/load';
import { revealMarked, useArrowKeys } from '../keys/keys';
import { stepRow, VERTICAL_ARROWS, type MarkedNode } from '../keys/keys.model';
import type { VirtualListHandle } from '../layout';
import type { HomeListItem } from './groups.model';
import type { Row } from './model';

interface RowRouter {
  push: (to: { pathname: string; params: { convId: string } }) => void;
}

export const rowDataSet = (convId: string): MarkedNode => ({ dataSet: { channelrow: convId } });

export function useRowArrows({
  rows,
  items,
  activePath,
  router,
  listRef,
}: {
  rows: readonly Row[];
  items: readonly HomeListItem[];
  activePath: string;
  router: RowRouter;
  listRef: React.RefObject<VirtualListHandle | null>;
}): void {
  const open = rows.find((row) => isActiveConversationPath(activePath, row.convId, row.peerAddress)) ?? null;
  useArrowKeys(open !== null, VERTICAL_ARROWS, (arrow) => {
    const next = stepRow(rows, open?.convId ?? null, arrow);
    if (next === null) return;
    prefetchFeed(lineOfConv(next.convId));
    router.push(conversationLinkOf(next.convId, next.peerAddress));
    if (!revealMarked(rowDataSet(next.convId))) listRef.current?.scrollToIndex({ index: items.indexOf(next), viewPosition: 0.5 });
  });
}
