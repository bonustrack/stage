import {
  DEFAULT_DEVELOPER_MODE,
  developerModeSchema,
  mergeDeveloperMode,
  type DeveloperModeContent,
} from '@stage-labs/client/xmtp/sync/developerMode';
import { getSelectedAccount } from './accounts';
import { accountScope } from './accountSelection';
import { useStoreValue } from './storeCore';
import { editDeveloperMode } from './syncedSettings.model';
import { syncedSetting } from './sync/setting';

const developerMode = syncedSetting<DeveloperModeContent>(
  {
    key: 'developer.mode.',
    default: DEFAULT_DEVELOPER_MODE,
    schema: developerModeSchema,
    perAccount: true,
    durable: true,
    readAccount: async () => (await getSelectedAccount())?.id ?? null,
  },
  { receive: mergeDeveloperMode },
);
const { prefs } = developerMode;

export const developerModeSync = developerMode.sync;

const enabled = (): boolean => prefs.loaded() && prefs.get().enabled;

export const retryDeveloperMode = prefs.retry;

export const useDeveloperMode = (): boolean => useStoreValue(prefs.subscribe, enabled, prefs.loadAsync);
export const useDeveloperModeLoaded = developerMode.useLoaded;
export const useDeveloperModeLoadFailed = (): boolean => useStoreValue(prefs.subscribe, prefs.loadFailed, prefs.loadAsync);

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
