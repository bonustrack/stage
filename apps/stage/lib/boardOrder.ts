import { boardOrderSchema } from '@stage-labs/client/xmtp/readState';
import { createValueStore } from './persistedStore';
import { notifyBoardOrderChanged } from './readSyncRegistry';

type BoardOrder = readonly string[];

function parseOrder(raw: string): BoardOrder | undefined {
  try {
    const parsed = boardOrderSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

const store = createValueStore<BoardOrder>({
  key: 'board.columnOrder', default: [], serialize: (v) => JSON.stringify(v), deserialize: parseOrder,
});

export const loadBoardOrder = (): Promise<BoardOrder> => store.load();

export function setBoardOrder(order: BoardOrder): void {
  store.set(order);
  notifyBoardOrderChanged(order);
}

export async function applyRemoteBoardOrder(order: BoardOrder): Promise<void> {
  await store.setAsync(order);
}

export const useBoardOrder = (): BoardOrder => store.use();
