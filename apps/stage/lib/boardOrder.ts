import { boardOrderSchema } from '@stage-labs/client/xmtp/sync/order';
import { createValueStore } from './persistedStore';
import { settingChanges, type SyncedSetting } from './sync/setting';

type BoardOrder = readonly string[];

const EMPTY: BoardOrder = [];

const prefs = createValueStore<BoardOrder>({ key: 'board.columnOrder.', default: EMPTY, schema: boardOrderSchema, perAccount: true });

export const useBoardOrder = prefs.use;

const localChanges = settingChanges<BoardOrder>();

export function setBoardOrder(next: BoardOrder): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  prefs.set(next);
  localChanges.notify({ accountId, state: next });
}

export const loadBoardOrder = prefs.loadFor;

export const boardOrderSync: SyncedSetting<BoardOrder> = {
  onLocalChange: localChanges.subscribe,
  load: loadBoardOrder,
  applyRemote: (accountId, incoming) => prefs.updateFor(accountId, () => incoming),
};
