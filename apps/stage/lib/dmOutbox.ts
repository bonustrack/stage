
import { bytesToHex } from 'viem';
import { createValueStore } from './persistedStore';
import { resolveDmConvId } from './dmResolve';
import { lineOfConv } from './xmtp.types';
import { xmtpSendText } from './xmtp.messages';
import { getActiveAccount } from './accounts';
import { knownActiveAccountId } from './channelsCache';
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
  return bytesToHex(bytes).slice(2);
}

export function subscribeDmOutbox(cb: () => void): () => void {
  store.loadAsync();
  return store.subscribe(cb);
}

const flushing = new Map<string, Promise<string | null>>();

async function activeAccountId(): Promise<string | null> {
  return (await getActiveAccount().catch(() => null))?.id ?? null;
}

export function queuedDmsFor(address: string): OutboxItem[] {
  return itemsForAddress(store.get(), address, knownActiveAccountId());
}

export async function enqueueDm(address: string, text: string): Promise<OutboxItem> {
  const items = await store.load();
  const accountId = await activeAccountId();
  const item: OutboxItem = {
    id: newId(),
    address: address.toLowerCase(),
    text,
    createdAt: Date.now(),
    ...(accountId === null ? {} : { accountId }),
  };
  store.set([...items, item]);
  return item;
}

async function deliverQueued(address: string, convId: string, accountId: string | null): Promise<void> {
  for (const item of itemsForAddress(store.get(), address, accountId)) {
    await xmtpSendText(lineOfConv(convId), item.text);
    store.set(withoutItem(store.get(), item.id));
  }
}

async function flushFor(address: string, accountId: string | null): Promise<string | null> {
  const items = itemsForAddress(await store.load(), address, accountId);
  if (items.length === 0) return null;
  const res = await resolveDmConvId(address).catch(() => null);
  if (!res || !('convId' in res)) return null;
  try {
    await deliverQueued(address, res.convId, accountId);
  } catch {
    return null;
  }
  return res.convId;
}

export async function flushDmOutboxFor(address: string): Promise<string | null> {
  const accountId = await activeAccountId();
  const key = `${accountId ?? ''}:${address.toLowerCase()}`;
  const running = flushing.get(key);
  if (running) return running;
  const flush = flushFor(address, accountId).finally(() => { flushing.delete(key); });
  flushing.set(key, flush);
  return flush;
}

export async function flushDmOutbox(): Promise<void> {
  const accountId = await activeAccountId();
  for (const address of addressesWithQueued(await store.load(), accountId)) {
    await flushDmOutboxFor(address).catch(() => null);
  }
}
