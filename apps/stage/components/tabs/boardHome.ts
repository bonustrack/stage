import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { getHomeView, setHomeView, useHomeView, useHomeViewLoaded } from '../../lib/homeView';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { homeRouteOf, isBoardHome } from './splitRoutes';
import { homeViewNavigation, type HomeViewNavigationState } from './homeViewNavigation.model';

export function useBoardHome(): boolean {
  return isBoardHome(usePathname(), useHomeView().view);
}

export function homeRoute(): string {
  return homeRouteOf(getHomeView().view);
}

export function useRememberHomeView(): void {
  const pathname = usePathname();
  const router = useRouter();
  const { view } = useHomeView();
  const loaded = useHomeViewLoaded();
  const epoch = useAccountEpoch();
  const previous = useRef<HomeViewNavigationState>({ epoch, pathname: null, restoringFrom: null });
  useEffect(() => {
    if (!loaded) return;
    const next = homeViewNavigation(pathname, view, previous.current, epoch);
    previous.current = next.state;
    if (next.restore !== null) router.replace(next.restore);
    else if (next.remember !== null) setHomeView({ view: next.remember });
  }, [pathname, view, loaded, epoch, router]);
}
