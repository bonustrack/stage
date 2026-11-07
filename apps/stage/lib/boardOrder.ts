import { boardOrderSchema } from '@stage-labs/client/xmtp/sync/order';
import type { StoreSource } from './persistedStore';
import { orderSetting } from './sync/setting';

type BoardOrder = readonly string[];

const EMPTY: BoardOrder = [];

const boardOrder = orderSetting({ key: 'board.columnOrder.', default: EMPTY, schema: boardOrderSchema, perAccount: true });

export const boardOrderSource: StoreSource<BoardOrder> = boardOrder.prefs;

export function setBoardOrder(next: BoardOrder): void {
  boardOrder.edit(() => next);
}

export const loadBoardOrder = boardOrder.prefs.loadFor;

export const boardOrderSync = boardOrder.sync;
