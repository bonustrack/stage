import {
  DEFAULT_DEVELOPER_MODE,
  developerModeSchema,
  mergeDeveloperMode,
  type DeveloperModeContent,
} from '@stage-labs/client/xmtp/readState';
import { getSelectedAccount } from './accounts';
import { getAccountEpoch, subscribeAccountEpoch } from './accountEpoch';
import { getAccountSelection, subscribeAccountSelection } from './accountSelection';
import { report } from './errorPolicy';
import { createValueStore } from './persistedStore';
import { makeListeners, useStoreValue } from './storeCore';
import { editDeveloperMode } from './syncedSettings.model';

function parseDeveloperMode(raw: string): DeveloperModeContent {
  try {
    const parsed = developerModeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_DEVELOPER_MODE;
  } catch (err) {
    report('developerMode.parse', err);
    return DEFAULT_DEVELOPER_MODE;
  }
}

const prefs = createValueStore<DeveloperModeContent>({
  key: 'developer.mode.',
  default: DEFAULT_DEVELOPER_MODE,
  deserialize: parseDeveloperMode,
  serialize: JSON.stringify,
  perAccount: true,
  durable: true,
});

let loadedSelection: number | undefined;
let failedSelection: number | undefined;
let pending: Promise<void> | null = null;
const changes = makeListeners();
const loaded = (): boolean => loadedSelection === getAccountSelection() && prefs.isCurrentAccount();
const failed = (): boolean => failedSelection === getAccountSelection();
const enabled = (): boolean => loaded() && prefs.get().enabled;

async function refresh(): Promise<void> {
  const selection = getAccountSelection();
  const account = await getSelectedAccount();
  await prefs.update((current) => current);
  if (prefs.accountId() !== (account?.id ?? null)) await prefs.update((current) => current);
  if (selection !== getAccountSelection() || !prefs.isCurrentAccount()) return refresh();
  if (prefs.accountId() !== (account?.id ?? null)) throw new Error('The selected account changed while loading Developer mode.');
  loadedSelection = selection;
}

function loadAsync(): void {
  if (loaded() || failed() || pending !== null) return;
  const selection = getAccountSelection();
  pending = refresh()
    .catch((err: unknown) => {
      if (selection === getAccountSelection()) failedSelection = selection;
      report('developerMode.load', err);
    })
    .finally(() => {
      pending = null;
      changes.notify();
      if (selection !== getAccountSelection()) loadAsync();
    });
}

export function retryDeveloperMode(): void {
  failedSelection = undefined;
  loadAsync();
  changes.notify();
}

function accountChanged(): void {
  loadedSelection = undefined;
  retryDeveloperMode();
}

prefs.subscribe(changes.notify);
subscribeAccountEpoch(accountChanged);
subscribeAccountSelection(accountChanged);

export const useDeveloperMode = (): boolean => useStoreValue(changes.subscribe, enabled, loadAsync);
export const useDeveloperModeLoaded = (): boolean => useStoreValue(changes.subscribe, loaded, loadAsync);
export const useDeveloperModeLoadFailed = (): boolean => useStoreValue(changes.subscribe, failed, loadAsync);

interface DeveloperModeChange {
  accountId: string;
  state: DeveloperModeContent;
}

const localChanges = makeListeners<DeveloperModeChange>();
export const onDeveloperModeChanged = localChanges.subscribe;

export async function setDeveloperMode(value: boolean): Promise<void> {
  const epoch = getAccountEpoch();
  const selection = getAccountSelection();
  const account = await getSelectedAccount();
  if (account === null || epoch !== getAccountEpoch() || selection !== getAccountSelection()) return;
  let state: DeveloperModeContent | null = null;
  await prefs.updateFor(account.id, (current) => {
    if (epoch !== getAccountEpoch() || selection !== getAccountSelection() || current.enabled === value) return current;
    state = editDeveloperMode(current, value, Date.now());
    return state;
  });
  if (state !== null) localChanges.notify({ accountId: account.id, state });
}

export async function loadDeveloperMode(accountId: string): Promise<DeveloperModeContent | null> {
  const state = await prefs.loadFor(accountId);
  return state.at > 0 ? state : null;
}

export function applyRemoteDeveloperMode(accountId: string, incoming: DeveloperModeContent): Promise<void> {
  return prefs.updateFor(accountId, (current) => mergeDeveloperMode(current, incoming));
}
