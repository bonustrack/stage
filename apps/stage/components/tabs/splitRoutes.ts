import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';
import { isOnboardingRoute } from '../onboarding/nextRoute.model';

const TAB_ROUTES = new Set(['/', '/contacts', '/wallet', '/settings']);

const BOARD_ROUTE = '/board';

const BOARD_PANEL_PREFIX = `${BOARD_ROUTE}/`;

const RAIL_ONLY_ROUTES = new Set([BOARD_ROUTE]);

const SPLIT_PREFIXES = [
  '/channel/', '/profile/', '/settings', '/wallet', '/contacts', '/add-members', '/frame',
];

function isDmRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && isPeerHandleSegment(segments[0]);
}

export function boardPanelConvId(pathname: string): string | null {
  if (!pathname.startsWith(BOARD_PANEL_PREFIX)) return null;
  const convId = pathname.slice(BOARD_PANEL_PREFIX.length);
  return convId === '' || convId.includes('/') ? null : convId;
}

export function isBoardRoute(pathname: string): boolean {
  return pathname === BOARD_ROUTE || boardPanelConvId(pathname) !== null;
}

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

export function isSplitRoute(pathname: string): boolean {
  if (isOnboardingRoute(pathname)) return false;
  if (pathname === '/' || isDmRoute(pathname) || boardPanelConvId(pathname) !== null) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isRailOnlyRoute(pathname: string): boolean {
  return RAIL_ONLY_ROUTES.has(pathname);
}

export function isRailedRoute(pathname: string): boolean {
  return isSplitRoute(pathname) || isRailOnlyRoute(pathname);
}
