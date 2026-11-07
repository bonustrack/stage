import { useMemo } from 'react';
import { DEFAULT_HOME_VIEW, homeViewSchema, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/sync/homeView';
import { reported } from './errorPolicy';
import type { StoreSource } from './persistedStore';
import { syncedSetting } from './sync/setting';
import { editHomeView, receiveHomeView, syncedHomeView, syncsHomeView } from './syncedSettings.model';

const homeView = syncedSetting<HomeViewContent>(
  { key: 'home.view.', default: DEFAULT_HOME_VIEW, schema: homeViewSchema, perAccount: true },
  { receive: receiveHomeView, synced: syncedHomeView },
);
const { prefs } = homeView;

export type HomeView = HomeViewContent['view'];

export const homeViewSync = homeView.sync;

export const useHomeView = prefs.use;

export const getHomeView = prefs.get;

export const homeViewSource: StoreSource<HomeViewContent> = prefs;

export function homeViewOf(stored: HomeViewContent, view: HomeView): HomeViewContent {
  return stored.view === view ? stored : { ...stored, view };
}

export function useHomeViewOf(view: HomeView): HomeViewContent {
  const stored = prefs.use();
  return useMemo(() => homeViewOf(stored, view), [stored, view]);
}

export const useHomeViewLoaded = homeView.useLoaded;

let viewRevision = 0;

export function setHomeView(edit: HomeViewEdit): void {
  const revision = edit.view === undefined ? viewRevision : ++viewRevision;
  const latest = (current: HomeViewContent): HomeViewEdit =>
    edit.view === undefined || revision === viewRevision ? edit : { ...edit, view: current.view };
  void homeView
    .editStored((current) => editHomeView(current, latest(current), Date.now()), syncsHomeView(edit))
    .catch(reported('homeView.save'));
}
