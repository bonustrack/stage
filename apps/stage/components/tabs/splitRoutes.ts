import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';
import type { HomeViewContent } from '@stage-labs/client/xmtp/readState';
import { isOnboardingRoute } from '../onboarding/nextRoute.model';

export const BOARD_ROUTE = '/board';

const TAB_ROUTES = new Set(['/', BOARD_ROUTE, '/wallet', '/settings']);

const CHANNEL_PREFIX = '/channel/';

const SPLIT_PREFIXES = [
  CHANNEL_PREFIX, '/profile/', '/settings', '/wallet', '/contacts', '/add-members', '/frame',
];

type HomeView = HomeViewContent['view'];

function isDmRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && isPeerHandleSegment(segments[0]);
}

export function channelRouteConvId(pathname: string): string | null {
  if (!pathname.startsWith(CHANNEL_PREFIX)) return null;
  const convId = pathname.slice(CHANNEL_PREFIX.length);
  return convId === '' || convId.includes('/') ? null : convId;
}

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

export function isSplitRoute(pathname: string): boolean {
  if (isOnboardingRoute(pathname)) return false;
  if (pathname === '/' || pathname === '/new') return true;
  if (isDmRoute(pathname)) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isRailOnlyRoute(pathname: string): boolean {
  return pathname === BOARD_ROUTE;
}

export function isRailRoute(pathname: string): boolean {
  return isSplitRoute(pathname) || isRailOnlyRoute(pathname);
}

export function homeViewAt(pathname: string): HomeView | null {
  if (pathname === BOARD_ROUTE) return 'board';
  return pathname === '/' ? 'chats' : null;
}

export function isBoardHome(pathname: string, lastView: HomeView): boolean {
  return (homeViewAt(pathname) ?? lastView) === 'board';
}

export function homeRouteOf(view: HomeView): string {
  return view === 'board' ? BOARD_ROUTE : '/';
}
