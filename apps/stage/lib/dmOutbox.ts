
import { createValueStore } from './persistedStore';
import { resolveDmConvId } from './dmResolve';
import { lineOfConv, xmtpSendText } from './xmtp';
import {
  addressesWithQueued, deserializeOutbox, itemsForAddress, withoutItem, type OutboxItem,
} from './dmOutbox.model';

const store = createValueStore<OutboxItem[]>({
  key: 'dm.outbox',
  default: [],
  serialize: JSON.stringify,
  deserialize: deserializeOutbox,
});

function newId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function subscribeDmOutbox(cb: () => void): () => void {
  store.loadAsync();
  return store.subscribe(cb);
}

export function queuedDmsFor(address: string): OutboxItem[] {
  return itemsForAddress(store.get(), address);
}

export async function enqueueDm(address: string, text: string): Promise<OutboxItem> {
  const items = await store.load();
  const item: OutboxItem = {
    id: newId(),
    address: address.toLowerCase(),
    text,
    createdAt: Date.now(),
  };
  store.set([...items, item]);
  return item;
}

async function deliverQueued(address: string, convId: string): Promise<void> {
  for (const item of itemsForAddress(store.get(), address)) {
    await xmtpSendText(lineOfConv(convId), item.text);
    store.set(withoutItem(store.get(), item.id));
  }
}

export async function flushDmOutboxFor(address: string): Promise<string | null> {
  const items = itemsForAddress(await store.load(), address);
  if (items.length === 0) return null;
  const res = await resolveDmConvId(address).catch(() => null);
  if (!res || !('convId' in res)) return null;
  try {
    await deliverQueued(address, res.convId);
  } catch {
    return null;
  }
  return res.convId;
}

export async function flushDmOutbox(): Promise<void> {
  for (const address of addressesWithQueued(await store.load())) {
    await flushDmOutboxFor(address).catch(() => null);
  }
}
