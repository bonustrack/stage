export const SETTINGS_ROUTE = '/settings';

export function hashRoute(url: string): string | null {
  const at = url.indexOf('#');
  return at === -1 ? null : url.slice(at + 1);
}

export function hashPath(url: string): string | null {
  const route = hashRoute(url);
  return route?.startsWith('/') ? route : null;
}
