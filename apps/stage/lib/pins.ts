import { movedPinOrder, pinOrderAfterRemote, toggledPinOrder, type PinOrder } from '@stage-labs/client/xmtp/pinOrder';
import type { PinStateContent } from '@stage-labs/client/xmtp/readState';
import { createValueStore } from './persistedStore';
import { notifyPinChanged } from './readSyncRegistry';

function parseOrder(raw: string): PinOrder | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : undefined;
  } catch { return undefined; }
}

const store = createValueStore<PinOrder>({
  key: 'channels.pinned', default: [], serialize: (v) => JSON.stringify(v), deserialize: parseOrder,
});

export const loadPinnedOrder = (): Promise<PinOrder> => store.load();

export const isPinned = (convId: string): boolean => store.get().includes(convId);

function commit(convId: string, next: PinOrder): PinOrder {
  store.set(next);
  notifyPinChanged({ convId, pinned: next.includes(convId), order: next });
  return next;
}

export const getPinnedOrder = (): PinOrder => store.get();

export async function togglePin(convId: string): Promise<PinOrder> {
  return commit(convId, toggledPinOrder(await store.load(), convId));
}

export function movePin(convId: string, toIndex: number): void {
  const current = store.get();
  const next = movedPinOrder(current, convId, toIndex);
  if (next !== current) commit(convId, next);
}

export async function applyRemotePinState(state: PinStateContent): Promise<void> {
  const current = await store.load();
  const next = pinOrderAfterRemote(current, state);
  if (next !== current) await store.setAsync(next);
}

export const subscribePins = (cb: () => void): () => void => store.subscribe(cb);
