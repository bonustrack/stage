/** Universal / deep-link routing for the messenger.
 *
 *  A single link must open the right screen whether it arrives as:
 *    - a web permalink   https://metro.box/#/xmtp/<convId>?m=<msgId>
 *    - the app scheme    metro://xmtp/<convId>?m=<msgId>
 *    - a verified applink https://metro.box/xmtp/<convId>   (no hash; future-proof)
 *
 *  The web client (apps/ui) uses vue-router in HASH mode, so its shareable URLs
 *  carry the route *after* the `#`. iOS/Android Universal Links strip the
 *  fragment before handing the URL to the app, but real-world share flows (the
 *  user pasting the copied permalink, an in-app `Linking.openURL`, a QR scan)
 *  keep it — so we parse the hash first and fall back to the path.
 *
 *  We deliberately DON'T use expo-router's static `linking` config: it parses
 *  the path segment, which for our hash-routed permalinks is empty. A tiny
 *  hand-rolled mapper is clearer and keeps the canonical route table in one
 *  place (`routeForUrl`).
 *
 *  NOTE: the iOS `associatedDomains` + Android intent filters that make the OS
 *  hand `https://metro.box/...` to the app live in app.json and only take
 *  effect in a NEW native build. The `metro://` scheme already works in the
 *  current dev client. */

import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { router } from 'expo-router';

/** An expo-router navigation target derived from an incoming link. */
export type ParsedRoute =
  | { pathname: '/xmtp/[convId]'; params: { convId: string; m?: string; focus?: string } }
  | { pathname: '/group/[convId]'; params: { convId: string } }
  | { pathname: '/user/[address]'; params: { address: string } }
  | { pathname: '/(tabs)'; params?: undefined }
  | { pathname: '/(tabs)/settings'; params?: undefined }
  | { pathname: '/(tabs)/contacts'; params?: undefined }
  | { pathname: '/(tabs)/profile'; params?: undefined };

/** Pull `{ path, query }` out of any inbound link, preferring the hash fragment
 *  (where the web client keeps its route) and falling back to the URL path.
 *  Handles `metro://xmtp/x`, `https://metro.box/#/xmtp/x?m=y`,
 *  `https://metro.box/xmtp/x`, and bare `xmtp/x`. */
export function extractRoute(url: string): { segments: string[]; query: URLSearchParams } {
  let work = url.trim();

  // Prefer the hash fragment if present: "....#/xmtp/abc?m=1" -> "/xmtp/abc?m=1".
  // (Web permalinks are hash-routed, so the real route lives after the `#`.)
  const hashIdx = work.indexOf('#');
  if (hashIdx !== -1) {
    work = work.slice(hashIdx + 1);
  } else {
    // No hash. The leading authority differs by scheme:
    //   http(s)://metro.box/xmtp/abc  → "metro.box" is a real host → strip it.
    //   metro://xmtp/abc              → "xmtp" is NOT a host, it's the first
    //                                    route segment → keep it.
    const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(work);
    if (m) {
      const scheme = m[1].toLowerCase();
      const rest = m[2];
      if (scheme === 'http' || scheme === 'https') {
        // Drop the host: everything up to the first '/', '?' or end.
        const cut = rest.search(/[/?]/);
        work = cut === -1 ? '/' : rest.slice(cut);
      } else {
        // Custom scheme — the authority IS the path (metro://xmtp/abc).
        work = '/' + rest;
      }
    }
  }

  const qIdx = work.indexOf('?');
  const pathPart = qIdx === -1 ? work : work.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : work.slice(qIdx + 1);

  const segments = pathPart
    .split('/')
    .map(s => decodeURIComponent(s))
    .filter(Boolean);

  return { segments, query: new URLSearchParams(queryPart) };
}

/** Map a parsed link to an expo-router target, or null when it doesn't address
 *  a known screen (in which case the deep link is ignored and the app opens
 *  to its default tab). */
export function routeForUrl(url: string): ParsedRoute | null {
  const { segments, query } = extractRoute(url);
  if (segments.length === 0) return { pathname: '/(tabs)' };

  const [head, second] = segments;
  switch (head) {
    case 'xmtp':
    case 'embed': {
      if (!second) return null;
      const m = query.get('m') ?? undefined;
      /** `focus=1` (e.g. opening from the floating pill) → the conversation
       *  screen auto-focuses the composer + raises the keyboard on arrival. */
      const focus = query.get('focus') ?? undefined;
      return {
        pathname: '/xmtp/[convId]',
        params: { convId: second, ...(m ? { m } : {}), ...(focus ? { focus } : {}) },
      };
    }
    case 'group':
      return second ? { pathname: '/group/[convId]', params: { convId: second } } : null;
    case 'user':
      return second ? { pathname: '/user/[address]', params: { address: second } } : null;
    case 'channels':
      return { pathname: '/(tabs)' };
    case 'settings':
      return { pathname: '/(tabs)/settings' };
    case 'contacts':
      return { pathname: '/(tabs)/contacts' };
    case 'profile':
      return { pathname: '/(tabs)/profile' };
    default:
      return null;
  }
}

/** Navigate to the screen a link addresses. Returns true when it matched a
 *  known route. */
export function navigateToUrl(url: string): boolean {
  const target = routeForUrl(url);
  if (!target) return false;
  // `router.push` is overloaded; the discriminated union above keeps each
  // pathname paired with the params its route declares.
  router.push(target as Parameters<typeof router.push>[0]);
  return true;
}

/** expo-router already auto-maps links whose route lives in the URL *path*
 *  (`metro://xmtp/x`, verified `https://metro.box/xmtp/x`) against the file
 *  tree — handling those here too would double-navigate. We only step in for
 *  the case it can't parse: hash-routed web permalinks
 *  (`https://metro.box/#/xmtp/x?m=y`), where the real route is in the fragment.
 *  `routeForUrl` stays general so it can be unit-tested / reused. */
function shouldHandle(url: string): boolean {
  return url.includes('#');
}

/** Mount-time hook: handle the cold-start URL (app launched by tapping a link)
 *  and subscribe to warm links (app already running). Call once near the root. */
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
