import { Platform } from 'react-native';

export function currentRoute(pathname: string): string {
  if (Platform.OS !== 'web') return pathname;
  const hash = window.location.hash;
  return hash.startsWith('#/') ? hash.slice(1) : pathname;
}

export function prettifyRouteQuery(): void {
  if (Platform.OS !== 'web') return;
  const hash = window.location.hash;
  const pretty = hash.replace(/%2F/gi, '/');
  if (pretty !== hash) window.history.replaceState(window.history.state, '', pretty);
}
