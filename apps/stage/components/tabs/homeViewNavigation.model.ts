import type { HomeViewContent } from '@stage-labs/client/xmtp/readState';
import { homeRouteOf, homeViewAt } from './splitRoutes';

type HomeView = HomeViewContent['view'];

export interface HomeViewNavigationState {
  epoch: number;
  pathname: string | null;
  restoringFrom: string | null;
}

function restoredHomeRoute(pathname: string, view: HomeView, previousPath: string | null, accountChanged: boolean): string | null {
  const visited = homeViewAt(pathname);
  if (visited === null || visited === view) return null;
  return accountChanged || (previousPath === null && pathname === '/') ? homeRouteOf(view) : null;
}

function rememberedHomeView(pathname: string, view: HomeView, previousPath: string | null): HomeView | null {
  const visited = homeViewAt(pathname);
  return previousPath !== pathname && (previousPath !== null || visited !== view) ? visited : null;
}

export function homeViewNavigation(pathname: string, view: HomeView, previous: HomeViewNavigationState, epoch: number) {
  const accountChanged = previous.epoch !== epoch;
  if (!accountChanged && previous.restoringFrom === pathname) return { state: previous, restore: null, remember: null };
  const previousPath = accountChanged ? null : previous.pathname;
  const restore = restoredHomeRoute(pathname, view, previousPath, accountChanged);
  return {
    state: { epoch, pathname: restore ?? pathname, restoringFrom: restore === null ? null : pathname },
    restore,
    remember: restore === null ? rememberedHomeView(pathname, view, previousPath) : null,
  };
}
