import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';
import { isOnboardingRoute } from '../onboarding/nextRoute.model';

const TAB_ROUTES = new Set(['/', '/contacts', '/wallet', '/settings']);

const RAIL_ONLY_ROUTES = new Set(['/board']);

const SPLIT_PREFIXES = [
  '/channel/', '/group/', '/profile/', '/settings', '/wallet', '/contacts', '/add-members',
];

function isDmRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && isPeerHandleSegment(segments[0]);
}

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

export function isSplitRoute(pathname: string): boolean {
  if (isOnboardingRoute(pathname)) return false;
  if (pathname === '/' || isDmRoute(pathname)) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isRailOnlyRoute(pathname: string): boolean {
  return RAIL_ONLY_ROUTES.has(pathname);
}

export function isRailedRoute(pathname: string): boolean {
  return isSplitRoute(pathname) || isRailOnlyRoute(pathname);
}
