import type { HomeViewContent } from '@stage-labs/client/xmtp/readState';
import { BOARD_ROUTE, homeViewAt } from './splitRoutes';

export function homeViewNavigation(pathname: string, view: HomeViewContent['view'], previousPath: string | null) {
  if (previousPath === null && pathname === '/' && view === 'board') {
    return { pathname: BOARD_ROUTE, restore: BOARD_ROUTE, remember: null };
  }
  const visited = homeViewAt(pathname);
  return { pathname, restore: null, remember: previousPath !== pathname && visited !== view ? visited : null };
}
