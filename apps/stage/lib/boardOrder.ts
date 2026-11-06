import { boardOrderSchema } from '@stage-labs/client/xmtp/sync/order';
import { createValueStore } from './persistedStore';
import { makeListeners } from './storeCore';

type BoardOrder = readonly string[];

const EMPTY: BoardOrder = [];

const prefs = createValueStore<BoardOrder>({ key: 'board.columnOrder.', default: EMPTY, schema: boardOrderSchema, perAccount: true });

export const useBoardOrder = prefs.use;

export interface AccountOrderChange {
  accountId: string;
  order: readonly string[];
}

const localChanges = makeListeners<AccountOrderChange>();
export const onBoardOrderChanged = localChanges.subscribe;

export function setBoardOrder(next: BoardOrder): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  prefs.set(next);
  localChanges.notify({ accountId, order: next });
}

export const loadBoardOrder = prefs.loadFor;

export function applyRemoteBoardOrder(forAccount: string, incoming: BoardOrder): Promise<void> {
  return prefs.updateFor(forAccount, () => incoming);
}
