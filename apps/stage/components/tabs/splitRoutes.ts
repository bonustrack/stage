import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';

const TAB_ROUTES = new Set(['/', '/contacts', '/wallet', '/settings']);

const SPLIT_PREFIXES = [
  '/channel/', '/group/', '/profile/', '/settings', '/wallet', '/contacts', '/accounts',
];

function isDmRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && isPeerHandleSegment(segments[0]);
}

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

export function isSplitRoute(pathname: string): boolean {
  if (pathname === '/' || isDmRoute(pathname)) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
