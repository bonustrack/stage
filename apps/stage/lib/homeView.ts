import { useMemo } from 'react';
import { DEFAULT_HOME_VIEW, homeViewSchema, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/sync/homeView';
import { reported } from './errorPolicy';
import { syncedSetting } from './sync/setting';
import { editHomeView, receiveHomeView, syncedHomeView, syncsHomeView } from './syncedSettings.model';

const homeView = syncedSetting<HomeViewContent>(
  { key: 'home.view.', default: DEFAULT_HOME_VIEW, schema: homeViewSchema, perAccount: true },
  { receive: receiveHomeView, synced: syncedHomeView },
);
const { prefs } = homeView;

export const homeViewSync = homeView.sync;

export const useHomeView = prefs.use;

export const getHomeView = prefs.get;

export function useHomeViewOf(view: HomeViewContent['view']): HomeViewContent {
  const stored = prefs.use();
  return useMemo(() => (stored.view === view ? stored : { ...stored, view }), [stored, view]);
}

export const useHomeViewLoaded = homeView.useLoaded;

export function setHomeView(edit: HomeViewEdit): void {
  void prefs
    .update((current) => editHomeView(current, edit, Date.now()))
    .then(() => {
      const accountId = prefs.accountId();
      if (accountId !== null && syncsHomeView(edit)) homeView.changedLocally(accountId, prefs.get());
    })
    .catch(reported('homeView.save'));
}
