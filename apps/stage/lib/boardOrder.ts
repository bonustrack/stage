import { boardOrderSchema } from '@stage-labs/client/xmtp/readState';
import { namedBoardOrder } from '../components/board/BoardScreen.model';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { notifyBoardOrderChanged } from './readSyncRegistry';
import { makeListeners, useStoreValue } from './storeCore';

type BoardOrder = readonly string[];

const KEY_PREFIX = 'board.columnOrder.';
const LEGACY_KEY = 'board.columnOrder';
const REGISTRY_PREFIX = 'labels.registry.';
const EMPTY: BoardOrder = [];

let accountId: string | null = null;
let order: BoardOrder = EMPTY;
let loading: Promise<void> | null = null;
const listeners = makeListeners();

function parseOrder(raw: string | null): BoardOrder {
  if (raw === null) return EMPTY;
  try {
    const parsed = boardOrderSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch { return EMPTY; }
}

async function storedOrder(id: string): Promise<BoardOrder> {
  return parseOrder(await appStorage.get(KEY_PREFIX + id));
}

async function adoptLegacyOrder(id: string): Promise<BoardOrder> {
  const legacy = await appStorage.get(LEGACY_KEY);
  if (legacy === null) return EMPTY;
  await appStorage.set(KEY_PREFIX + id, legacy);
  await appStorage.delete(LEGACY_KEY);
  return parseOrder(legacy);
}

function persist(id: string, next: BoardOrder): Promise<void> {
  return appStorage.set(KEY_PREFIX + id, JSON.stringify(next));
}

async function namedOrder(id: string, loaded: BoardOrder): Promise<BoardOrder> {
  const registry = await appStorage.get(REGISTRY_PREFIX + id);
  if (registry === null) return loaded;
  const next = namedBoardOrder(loaded, registry);
  await persist(id, next);
  await appStorage.delete(REGISTRY_PREFIX + id);
  if (next.length !== loaded.length || next.some((key, index) => key !== loaded[index])) notifyBoardOrderChanged({ accountId: id, order: next });
  return next;
}

async function loadForActiveAccount(): Promise<void> {
  const id = (await getActiveAccount())?.id ?? null;
  if (id === accountId) return;
  const saved = id === null ? null : await appStorage.get(KEY_PREFIX + id);
  const loaded = id === null || saved !== null ? parseOrder(saved) : await adoptLegacyOrder(id);
  const next = id === null ? loaded : await namedOrder(id, loaded);
  accountId = id;
  order = next;
  listeners.notify();
  await loadForActiveAccount();
}

function ensureLoaded(): Promise<void> {
  loading ??= loadForActiveAccount().finally(() => { loading = null; });
  return loading;
}

function primeBoardOrder(): void { void ensureLoaded().catch(reported('boardOrder.load')); }

subscribeAccountEpoch(primeBoardOrder);

export function setBoardOrder(next: BoardOrder): void {
  if (accountId === null) return;
  order = next;
  listeners.notify();
  void persist(accountId, next).catch(reported('boardOrder.save'));
  notifyBoardOrderChanged({ accountId, order: next });
}

export async function loadBoardOrder(forAccount: string): Promise<BoardOrder> {
  await ensureLoaded();
  return forAccount === accountId ? order : storedOrder(forAccount);
}

export async function applyRemoteBoardOrder(forAccount: string, next: BoardOrder): Promise<void> {
  await ensureLoaded();
  if (forAccount === accountId) {
    order = next;
    listeners.notify();
  }
  await persist(forAccount, next);
}

const getBoardOrder = (): BoardOrder => order;

export const useBoardOrder = (): BoardOrder => useStoreValue(listeners.subscribe, getBoardOrder, primeBoardOrder);
