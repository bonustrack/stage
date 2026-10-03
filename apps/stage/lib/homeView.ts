import { DEFAULT_HOME_VIEW, homeViewSchema, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/readState';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';
import { makeListeners, useStoreValue } from './storeCore';
import { editHomeView, receiveHomeView, syncedHomeView, syncsHomeView } from './syncedSettings.model';

function parseHomeView(raw: string): HomeViewContent {
  try {
    const parsed = homeViewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_HOME_VIEW;
  } catch { return DEFAULT_HOME_VIEW; }
}

const prefs = createValueStore<HomeViewContent>({
  key: 'home.view.', default: DEFAULT_HOME_VIEW, deserialize: parseHomeView, serialize: JSON.stringify, perAccount: true,
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
  const state = await prefs.loadFor(forAccount);
  return state.at > 0 ? syncedHomeView(state) : null;
}

export function applyRemoteHomeView(forAccount: string, incoming: HomeViewContent): Promise<void> {
  return prefs.updateFor(forAccount, current => receiveHomeView(current, incoming));
}
