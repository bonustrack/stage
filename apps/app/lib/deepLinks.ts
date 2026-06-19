/**
 * @file Maps inbound universal/deep links to expo-router messenger routes (routeForUrl).
 *  Handles web hash permalinks, the metro:// scheme, and verified applinks by parsing the hash fragment first, then the path.
 */

import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { router } from 'expo-router';

/** An expo-router navigation target derived from an incoming link. */
type ParsedRoute =
  | { pathname: '/xmtp/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/group/[convId]'; params: { convId: string } }
  | { pathname: '/user/[address]'; params: { address: string } }
  | { pathname: '/(tabs)'; params?: undefined }
  | { pathname: '/(tabs)/settings'; params?: undefined }
  | { pathname: '/(tabs)/contacts'; params?: undefined };

/** Strip the scheme+authority off a non-hash link, yielding a leading-slash path (http(s) drops the host; custom schemes keep the authority as the first segment). */
function stripAuthority(work: string): string {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(work);
  const scheme = m?.[1];
  const rest = m?.[2];
  if (scheme === undefined || rest === undefined) return work;
  if (scheme.toLowerCase() === 'http' || scheme.toLowerCase() === 'https') {
    // Drop the host: everything up to the first '/', '?' or end.
    const cut = rest.search(/[/?]/);
    return cut === -1 ? '/' : rest.slice(cut);
  }
  // Custom scheme — the authority IS the path (metro://xmtp/abc).
  return '/' + rest;
}

/** Pull `{ segments, query }` out of any inbound link, preferring the hash fragment (web routes) and falling back to the URL path. */
function extractRoute(url: string): { segments: string[]; query: URLSearchParams } {
  let work = url.trim();

  // Prefer the hash fragment if present: "....#/xmtp/abc?m=1" -> "/xmtp/abc?m=1".
  // (Web permalinks are hash-routed, so the real route lives after the `#`.)
  const hashIdx = work.indexOf('#');
  work = hashIdx !== -1 ? work.slice(hashIdx + 1) : stripAuthority(work);

  const qIdx = work.indexOf('?');
  const pathPart = qIdx === -1 ? work : work.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : work.slice(qIdx + 1);

  const segments = pathPart
    .split('/')
    .map(s => decodeURIComponent(s))
    .filter(Boolean);

  return { segments, query: new URLSearchParams(queryPart) };
}

/** Build the conversation route for an `xmtp`/`embed` link, carrying optional `m` and `focus` query params. */
function conversationRoute(second: string | undefined, query: URLSearchParams): ParsedRoute | null {
  if (!second) return null;
  const m = query.get('m') ?? undefined;
  // `focus=1` → the conversation screen auto-focuses the composer + raises the keyboard on arrival.
  const focus = query.get('focus') ?? undefined;
  return {
    pathname: '/xmtp/[convId]',
    params: { convId: second, ...(m ? { m } : {}), ...(focus ? { focus } : {}) },
  };
}

/** Static (no-param) head segments that map directly to a fixed tab route. */
const STATIC_ROUTES: Record<string, ParsedRoute> = {
  channels: { pathname: '/(tabs)' },
  settings: { pathname: '/(tabs)/settings' },
  contacts: { pathname: '/(tabs)/contacts' },
};

/** Map a parsed link to an expo-router target, or null when it doesn't address a known screen (in which case the deep link is ignored and the app opens to its default tab). */
function routeForUrl(url: string): ParsedRoute | null {
  const { segments, query } = extractRoute(url);
  if (segments.length === 0) return { pathname: '/(tabs)' };

  const [head, second] = segments;
  if (head === 'xmtp' || head === 'embed') return conversationRoute(second, query);
  if (head === 'group') {
    return second ? { pathname: '/group/[convId]', params: { convId: second } } : null;
  }
  if (head === 'user') {
    return second ? { pathname: '/user/[address]', params: { address: second } } : null;
  }
  return (head !== undefined ? STATIC_ROUTES[head] : undefined) ?? null;
}

/** Navigate to the screen a link addresses. Returns true when it matched a known route. */
function navigateToUrl(url: string): boolean {
  const target = routeForUrl(url);
  if (!target) return false;
  // `router.push` is overloaded; the discriminated union above keeps each
  // pathname paired with the params its route declares.
  router.push(target);
  return true;
}

/**
 * expo-router already auto-maps links whose route lives in the URL *path*
 *  (`metro://xmtp/x`, verified `https://metro.box/xmtp/x`) against the file
 *  tree — handling those here too would double-navigate. We only step in for
 *  the case it can't parse: hash-routed web permalinks
 *  (`https://metro.box/#/xmtp/x?m=y`), where the real route is in the fragment.
 *  `routeForUrl` stays general so it can be unit-tested / reused.
 */
function shouldHandle(url: string): boolean {
  return url.includes('#');
}

/** Mount-time hook: handle the cold-start URL (app launched by tapping a link) and subscribe to warm links (app already running). Call once near the root. */
export function useDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;

    // Cold start: the URL the app was opened with, if any.
    void Linking.getInitialURL().then(url => {
      if (!cancelled && url && shouldHandle(url)) navigateToUrl(url);
    });

    // Warm: links delivered while the app is already foregrounded/backgrounded.
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url && shouldHandle(url)) navigateToUrl(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
