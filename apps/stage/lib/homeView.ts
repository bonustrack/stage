import { DEFAULT_HOME_VIEW, homeViewSchema, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';
import { makeListeners, useStoreValue } from './storeCore';
import { editHomeView, receiveHomeView, syncedHomeView, syncsHomeView } from './homeView.model';

const KEY_PREFIX = 'home.view.';

function parseHomeView(raw: string): HomeViewContent {
  try {
    const parsed = homeViewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_HOME_VIEW;
  } catch { return DEFAULT_HOME_VIEW; }
}

const prefs = createValueStore<HomeViewContent>({
  key: KEY_PREFIX, default: DEFAULT_HOME_VIEW, deserialize: parseHomeView, serialize: JSON.stringify, perAccount: true,
});

export const useHomeView = prefs.use;

const homeViewLoaded = (): boolean => prefs.accountId() !== null;

export const useHomeViewLoaded = (): boolean => useStoreValue(prefs.subscribe, homeViewLoaded, prefs.loadAsync);

export interface HomeViewChange {
  accountId: string;
  state: HomeViewContent;
}

const localChanges = makeListeners<HomeViewChange>();
export const onHomeViewChanged = localChanges.subscribe;

export function setHomeView(edit: HomeViewEdit): void {
  void prefs.update(current => editHomeView(current, edit, Date.now()))
    .then(() => {
      const accountId = prefs.accountId();
      if (accountId !== null && syncsHomeView(edit)) localChanges.notify({ accountId, state: syncedHomeView(prefs.get()) });
    })
    .catch(reported('homeView.save'));
}

export async function loadHomeView(forAccount: string): Promise<HomeViewContent | null> {
  await prefs.load();
  const state = forAccount === prefs.accountId() ? prefs.get() : parseHomeView(await appStorage.get(KEY_PREFIX + forAccount) ?? '');
  return state.at > 0 ? syncedHomeView(state) : null;
}

export async function applyRemoteHomeView(forAccount: string, incoming: HomeViewContent): Promise<void> {
  await prefs.load();
  if (forAccount === prefs.accountId()) {
    await prefs.update(current => receiveHomeView(current, incoming));
    return;
  }
  const stored = parseHomeView(await appStorage.get(KEY_PREFIX + forAccount) ?? '');
  const next = receiveHomeView(stored, incoming);
  if (next !== stored) await appStorage.set(KEY_PREFIX + forAccount, JSON.stringify(next));
}
