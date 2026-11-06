import { movedPinOrder, pinOrderAfterRemote, toggledPinOrder, type PinOrder } from '@stage-labs/client/xmtp/pinOrder';
import type { PinStateContent } from '@stage-labs/client/xmtp/sync/pin';
import { createValueStore } from './persistedStore';
import { makeListeners, storedStrings } from './storeCore';

export interface PinChange {
  convId: string;
  pinned: boolean;
  order: readonly string[];
}

const pinChanges = makeListeners<PinChange>();
export const onPinChanged = pinChanges.subscribe;

const store = createValueStore<PinOrder>({ key: 'channels.pinned', default: [], schema: storedStrings });

export const isPinned = (convId: string): boolean => store.get().includes(convId);

export const loadPinnedOrder = (): Promise<PinOrder> => store.load();

function commit(convId: string, next: PinOrder): PinOrder {
  store.set(next);
  pinChanges.notify({ convId, pinned: next.includes(convId), order: next });
  return next;
}

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

export const usePinnedOrder = (): PinOrder => store.use();
