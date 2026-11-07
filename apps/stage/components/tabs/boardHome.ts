import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { getHomeView, setHomeView, useHomeView, useHomeViewLoaded } from '../../lib/homeView';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { homeRouteOf, isBoardHome } from './splitRoutes';
import { homeViewNavigation } from './homeViewNavigation.model';

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
  const previous = useRef<{ epoch: number; pathname: string | null; restoring: boolean }>({ epoch, pathname: null, restoring: false });
  useEffect(() => {
    if (!loaded) return;
    const current = previous.current;
    if (current.epoch === epoch && current.restoring && pathname === '/') return;
    const next = homeViewNavigation(pathname, view, current.epoch === epoch ? current.pathname : null);
    previous.current = { epoch, pathname: next.pathname, restoring: next.restore !== null };
    if (next.restore !== null) router.replace(next.restore);
    else if (next.remember !== null) setHomeView({ view: next.remember });
  }, [pathname, view, loaded, epoch, router]);
}
