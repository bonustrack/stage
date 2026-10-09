import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { getHomeView, setHomeView, useHomeView } from '../../lib/homeView';
import { homeRouteOf, homeViewAt, isBoardHome } from './splitRoutes';

export function useBoardHome(): boolean {
  return isBoardHome(usePathname(), useHomeView().view);
}

export function homeRoute(): string {
  return homeRouteOf(getHomeView().view);
}

export function useRememberHomeView(): void {
  const visited = homeViewAt(usePathname());
  const { view } = useHomeView();
  useEffect(() => {
    if (visited !== null && visited !== view) setHomeView({ view: visited });
  }, [visited, view]);
}
