import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';
import { isOnboardingRoute } from '../onboarding/nextRoute.model';

const TAB_ROUTES = new Set(['/', '/contacts', '/wallet', '/settings']);

const CHANNEL_PREFIX = '/channel/';

const SPLIT_PREFIXES = [
  CHANNEL_PREFIX, '/profile/', '/settings', '/wallet', '/contacts', '/add-members', '/frame',
];

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

export function isSplitRoute(pathname: string, boardHome = false): boolean {
  if (isOnboardingRoute(pathname)) return false;
  if (pathname === '/') return !boardHome;
  if (isDmRoute(pathname)) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isRailOnlyRoute(pathname: string, boardHome: boolean): boolean {
  return pathname === '/' && boardHome;
}
