import {
  DEFAULT_DEVELOPER_MODE,
  developerModeSchema,
  mergeDeveloperMode,
  type DeveloperModeContent,
} from '@stage-labs/client/xmtp/sync/developerMode';
import { getSelectedAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { accountScope, getAccountSelection, subscribeAccountSelection } from './accountSelection';
import { report } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';
import { editDeveloperMode } from './syncedSettings.model';
import { syncedSetting } from './sync/setting';

function parseDeveloperMode(raw: string): DeveloperModeContent {
  try {
    const parsed = developerModeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_DEVELOPER_MODE;
  } catch (err) {
    report('developerMode.parse', err);
    return DEFAULT_DEVELOPER_MODE;
  }
}

const developerMode = syncedSetting<DeveloperModeContent>(
  {
    key: 'developer.mode.',
    default: DEFAULT_DEVELOPER_MODE,
    deserialize: parseDeveloperMode,
    serialize: JSON.stringify,
    perAccount: true,
    durable: true,
  },
  { receive: mergeDeveloperMode },
);
const { prefs } = developerMode;

export const developerModeSync = developerMode.sync;

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
  await prefs.reload();
  if (prefs.accountId() !== (account?.id ?? null)) await prefs.reload();
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

export async function setDeveloperMode(value: boolean): Promise<void> {
  const scope = accountScope();
  const account = await getSelectedAccount();
  if (account === null || !scope.current()) return;
  let state: DeveloperModeContent | null = null;
  await prefs.updateFor(account.id, (current) => {
    if (!scope.current() || current.enabled === value) return current;
    state = editDeveloperMode(current, value, Date.now());
    return state;
  });
  if (state !== null) developerMode.changedLocally(account.id, state);
}
