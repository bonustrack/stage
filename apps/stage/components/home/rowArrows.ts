import { conversationLinkOf, isActiveConversationPathFor } from '../../lib/links';
import { lineOfConv, prefetchFeed } from '../../modules/messaging';
import { revealMarked, useArrowKeys } from '../arrowKeys';
import { stepRow, VERTICAL_ARROWS, type MarkedNode } from '../arrowKeys.model';
import type { VirtualListHandle } from '../layout';
import type { Row } from './model';

interface RowRouter {
  push: (to: { pathname: string; params: { convId: string } }) => void;
}

export const rowDataSet = (convId: string): MarkedNode => ({ dataSet: { channelrow: convId } });

export function useRowArrows({ rows, activePath, router, listRef }: {
  rows: readonly Row[];
  activePath: string;
  router: RowRouter;
  listRef: React.RefObject<VirtualListHandle | null>;
}): void {
  const open = rows.find(row => isActiveConversationPathFor(activePath, row.convId, row.peerAddress)) ?? null;
  useArrowKeys(open !== null, VERTICAL_ARROWS, (arrow) => {
    const next = stepRow(rows, open?.convId ?? null, arrow);
    if (next === null) return;
    prefetchFeed(lineOfConv(next.convId));
    router.push(conversationLinkOf(next.convId, next.peerAddress));
    if (!revealMarked(rowDataSet(next.convId))) listRef.current?.scrollToIndex({ index: rows.indexOf(next), viewPosition: 0.5 });
  });
}
