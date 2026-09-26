import {
  labelEntriesSchema, mergeLabelEntries, renamedLabelEntries, sameLabelEntries, withLabelNames,
  type LabelEntry,
} from '@stage-labs/client/xmtp/labelRegistry';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { notifyLabelRegistryChanged } from './readSyncRegistry';
import { makeListeners, useStoreValue } from './storeCore';

type LabelEntries = readonly LabelEntry[];

const KEY_PREFIX = 'labels.registry.';
const EMPTY: LabelEntries = [];

let accountId: string | null = null;
let entries: LabelEntries = EMPTY;
let loading: Promise<void> | null = null;
const listeners = makeListeners();

function parseEntries(raw: string | null): LabelEntries {
  if (raw === null) return EMPTY;
  try {
    const parsed = labelEntriesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch { return EMPTY; }
}

async function storedEntries(id: string): Promise<LabelEntries> {
  return parseEntries(await appStorage.get(KEY_PREFIX + id));
}

async function loadForActiveAccount(): Promise<void> {
  const id = (await getActiveAccount())?.id ?? null;
  if (id === accountId) return;
  const next = id === null ? EMPTY : await storedEntries(id);
  accountId = id;
  entries = next;
  listeners.notify();
  await loadForActiveAccount();
}

function ensureLoaded(): Promise<void> {
  loading ??= loadForActiveAccount().finally(() => { loading = null; });
  return loading;
}

function primeLabelEntries(): void { void ensureLoaded().catch(reported('labelRegistry.load')); }

subscribeAccountEpoch(primeLabelEntries);

function persist(id: string, next: LabelEntries): Promise<void> {
  return appStorage.set(KEY_PREFIX + id, JSON.stringify(next));
}

function commit(next: LabelEntries): void {
  if (accountId === null || sameLabelEntries(next, entries)) return;
  entries = next;
  listeners.notify();
  void persist(accountId, next).catch(reported('labelRegistry.save'));
  notifyLabelRegistryChanged({ accountId, labels: next });
}

export async function ensureLabelEntries(names: readonly string[]): Promise<void> {
  await ensureLoaded();
  commit(withLabelNames(entries, names));
}

export function renameLabelEntry(entry: LabelEntry, name: string): void {
  commit(renamedLabelEntries(entries, entry, name, Date.now()));
}

export async function loadLabelEntries(forAccount: string): Promise<LabelEntries> {
  await ensureLoaded();
  return forAccount === accountId ? entries : storedEntries(forAccount);
}

export async function applyRemoteLabels(forAccount: string, incoming: LabelEntries): Promise<void> {
  const current = await loadLabelEntries(forAccount);
  const next = mergeLabelEntries(current, incoming);
  if (sameLabelEntries(next, current)) return;
  if (forAccount === accountId) {
    entries = next;
    listeners.notify();
  }
  await persist(forAccount, next);
}

const getLabelEntries = (): LabelEntries => entries;

export const useLabelEntries = (): LabelEntries => useStoreValue(listeners.subscribe, getLabelEntries, primeLabelEntries);
