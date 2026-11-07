import {
  DEFAULT_DEVELOPER_MODE,
  developerModeSchema,
  mergeDeveloperMode,
  type DeveloperModeContent,
} from '@stage-labs/client/xmtp/sync/developerMode';
import { getSelectedAccount } from './accounts';
import { AccountChangedError, accountScope, selectionScope, subscribeAccountChange, type SelectionScope } from './accountSelection';
import { report } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';
import { editDeveloperMode } from './syncedSettings.model';
import { syncedSetting } from './sync/setting';

const developerMode = syncedSetting<DeveloperModeContent>(
  { key: 'developer.mode.', default: DEFAULT_DEVELOPER_MODE, schema: developerModeSchema, perAccount: true, durable: true },
  { receive: mergeDeveloperMode },
);
const { prefs } = developerMode;

export const developerModeSync = developerMode.sync;

let loadedFor: SelectionScope | null = null;
let failedFor: SelectionScope | null = null;
let pending: Promise<void> | null = null;
const changes = makeListeners();
const loaded = (): boolean => loadedFor?.current() === true && prefs.isCurrentAccount();
const failed = (): boolean => failedFor?.current() === true;
const enabled = (): boolean => loaded() && prefs.get().enabled;

async function refresh(): Promise<SelectionScope> {
  const scope = selectionScope();
  const account = await getSelectedAccount();
  await prefs.reload();
  if (!scope.current() || !prefs.isCurrentAccount()) return refresh();
  if (prefs.accountId() !== (account?.id ?? null))
    throw new AccountChangedError('The selected account changed while loading Developer mode.');
  return scope;
}

function loadAsync(): void {
  if (loaded() || failed() || pending !== null) return;
  const scope = selectionScope();
  pending = refresh()
    .then((done) => {
      loadedFor = done;
    })
    .catch((err: unknown) => {
      if (scope.current()) failedFor = scope;
      report('developerMode.load', err);
    })
    .finally(() => {
      pending = null;
      changes.notify();
      if (!scope.current()) loadAsync();
    });
}

export function retryDeveloperMode(): void {
  failedFor = null;
  loadAsync();
  changes.notify();
}

prefs.subscribe(changes.notify);
subscribeAccountChange(() => {
  loadedFor = null;
  retryDeveloperMode();
});

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
