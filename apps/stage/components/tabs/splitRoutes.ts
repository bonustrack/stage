import { channelPath } from '@stage-labs/client/routing/routes';
import { PAGES, pageList, splitAt, tabPageAt, type HomeView } from './pages';

const CHANNEL_PREFIX = channelPath('');

export function channelRouteConvId(pathname: string): string | null {
  if (!pathname.startsWith(CHANNEL_PREFIX)) return null;
  const convId = pathname.slice(CHANNEL_PREFIX.length);
  return convId === '' || convId.includes('/') ? null : convId;
}

export function isTabRoute(pathname: string): boolean {
  return tabPageAt(pathname) !== undefined;
}

export function isSplitRoute(pathname: string): boolean {
  return splitAt(pathname) === 'pane';
}

export function isRailOnlyRoute(pathname: string): boolean {
  return splitAt(pathname) === 'rail';
}

export function isRailRoute(pathname: string): boolean {
  return isSplitRoute(pathname) || isRailOnlyRoute(pathname);
}

export function homeViewAt(pathname: string): HomeView | null {
  return pageList().find((page) => page.home !== undefined && page.href === pathname)?.home ?? null;
}

export function isBoardHome(pathname: string, lastView: HomeView): boolean {
  return (homeViewAt(pathname) ?? lastView) === 'board';
}

export function homeRouteOf(view: HomeView): string {
  return view === 'board' ? PAGES.board.href : PAGES.chats.href;
}
