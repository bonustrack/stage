const DM_ROUTE = /^\/0x[a-fA-F0-9]{40}$/;

const TAB_ROUTES = new Set(['/', '/contacts', '/wallet', '/settings']);

const SPLIT_PREFIXES = [
  '/channel/', '/group/', '/profile/', '/settings', '/wallet', '/contacts', '/accounts',
];

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

export function isSplitRoute(pathname: string): boolean {
  if (pathname === '/' || DM_ROUTE.test(pathname)) return true;
  return SPLIT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
