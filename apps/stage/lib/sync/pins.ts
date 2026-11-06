import { movedPinOrder, pinOrderAfterRemote, toggledPinOrder, type PinOrder } from '@stage-labs/client/xmtp/pinOrder';
import type { PinStateContent } from '@stage-labs/client/xmtp/sync/pin';
import { createValueStore } from '../persistedStore';
import { makeListeners, storedStrings } from '../storeCore';
import { rowIdOfConv } from '../xmtp.conv';
import { stampLocal, takeIfNewer } from './clock';
import { defineAppSyncKind } from './kind';

interface PinChange {
  convId: string;
  pinned: boolean;
  order: readonly string[];
}

const PIN_ORDER_KEY = 'pinOrder';
const pinKey = (convId: string): string => `pin:${convId}`;

const pinChanges = makeListeners<PinChange>();

const store = createValueStore<PinOrder>({ key: 'channels.pinned', default: [], schema: storedStrings });

export const isPinned = (convId: string): boolean => store.get().includes(convId);

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

async function applyRemotePinState(state: PinStateContent): Promise<void> {
  const current = await store.load();
  const next = pinOrderAfterRemote(current, state);
  if (next !== current) await store.setAsync(next);
}

export const usePinnedOrder = (): PinOrder => store.use();

async function pinStateForRows(state: PinStateContent): Promise<PinStateContent> {
  const convId = await rowIdOfConv(state.convId);
  if (state.order === undefined) return { ...state, convId };
  const order = [...new Set(await Promise.all(state.order.map(rowIdOfConv)))];
  return { ...state, convId, order };
}

async function applyPinStates(remote: readonly PinStateContent[]): Promise<void> {
  for (const state of await Promise.all(remote.map(pinStateForRows))) {
    if (takeIfNewer(state.order === undefined ? pinKey(state.convId) : PIN_ORDER_KEY, state.at)) await applyRemotePinState(state);
  }
}

export const PIN_KIND = defineAppSyncKind({
  kind: 'pin',
  watch: (publish) => {
    pinChanges.subscribe((change) => {
      const at = stampLocal(pinKey(change.convId));
      stampLocal(PIN_ORDER_KEY, at);
      const content: PinStateContent = { convId: change.convId, pinned: change.pinned, order: [...change.order], at };
      publish({ key: PIN_ORDER_KEY, content: () => Promise.resolve(content) });
    });
  },
  apply: (_accountId, replay) => applyPinStates(replay.pin),
  snapshot: async () => {
    const order = await store.load();
    const first = order[0];
    if (first === undefined) return null;
    return { convId: first, pinned: true, order: [...order], at: stampLocal(PIN_ORDER_KEY) };
  },
});
