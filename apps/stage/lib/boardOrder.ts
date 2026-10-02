import { boardOrderSchema } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';

type BoardOrder = readonly string[];

const KEY_PREFIX = 'board.columnOrder.';
const EMPTY: BoardOrder = [];

let accountId: string | null = null;
let order: BoardOrder = EMPTY;
let loading: Promise<void> | null = null;
const listeners = makeListeners();

export interface AccountOrderChange {
  accountId: string;
  order: readonly string[];
}

const localChanges = makeListeners<AccountOrderChange>();
export const onBoardOrderChanged = localChanges.subscribe;

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

function persist(id: string, next: BoardOrder): Promise<void> {
  return appStorage.set(KEY_PREFIX + id, JSON.stringify(next));
}

async function loadForActiveAccount(): Promise<void> {
  const id = (await getActiveAccount())?.id ?? null;
  if (id === accountId) return;
  const next = id === null ? EMPTY : await storedOrder(id);
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
  localChanges.notify({ accountId, order: next });
}

export async function loadBoardOrder(forAccount: string): Promise<BoardOrder> {
  await ensureLoaded();
  return forAccount === accountId ? order : storedOrder(forAccount);
}

export async function applyRemoteBoardOrder(forAccount: string, incoming: BoardOrder): Promise<void> {
  await ensureLoaded();
  if (forAccount === accountId) {
    order = incoming;
    listeners.notify();
  }
  await persist(forAccount, incoming);
}

const getBoardOrder = (): BoardOrder => order;

export const useBoardOrder = (): BoardOrder => useStoreValue(listeners.subscribe, getBoardOrder, primeBoardOrder);
