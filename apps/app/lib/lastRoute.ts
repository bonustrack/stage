/** Restore-last-screen: persist the current route to AsyncStorage on every
 *  navigation and, on a cold launch, return the user to where they left off -
 *  WITHOUT flashing the Home tab first.
 *
 *  expo-router owns its own NavigationContainer, so there's no public
 *  `initialState` to hand it. The supported, framework-friendly path is to
 *  persist the live `usePathname()` and, after mount, navigate to the saved
 *  location - a pragmatic restore that composes with the existing
 *  NativeSwipeStack + deep-link routing rather than fighting the container.
 *
 *  NO HOME FLASH (the gate): the previous version waited ~150ms and then
 *  async-read the saved route + pushed, so `(tabs)/index` (Home) mounted and
 *  COMMITTED a frame before the redirect landed - a visible flash. We now mirror
 *  the onboarding idiom (lib/onboardingSeen): the root layout holds its boot
 *  spinner until `useRestoreGate().ready` (the one-time AsyncStorage read has
 *  resolved). The Stack - and therefore Home - is never mounted until the
 *  restore decision is known, so the FIRST committed frame is the channel.
 *  Once ready, the restore fires SYNCHRONOUSLY on the first render (no timer),
 *  so there is no intermediate Home paint.
 *
 *  BACK-STACK CORRECTNESS: every restorable route is a DETAIL screen that lives
 *  in the ROOT stack as a sibling of `(tabs)` (xmtp/group/user/wallet/...). We
 *  restore with `router.push`, NOT `router.replace`: at restore time the app is
 *  at the `(tabs)` root, so a PUSH lands the detail screen ON TOP of `(tabs)`,
 *  leaving the tab root as the entry beneath it. That makes `canGoBack()` true
 *  after restore, so the header back button / hardware back / edge-swipe all pop
 *  cleanly to the tab - instead of a `replace`, which would make the detail
 *  screen the SOLE stack entry with nothing beneath it (back → crash).
 *
 *  COORDINATION WITH DEEP LINKS: a cold-start deep link (push tap / universal
 *  link) must WIN over the saved route. We resolve `Linking.getInitialURL()`
 *  inside the same one-time gate load: if the launch URL addresses a screen we
 *  recognise, we SKIP the restore entirely and let useDeepLinks navigate. No
 *  timer race - the decision is made from the resolved launch URL, not from
 *  "did a navigation happen in the last 150ms".
 *
 *  EDGE HANDLING:
 *    - Only DETAIL routes are restored (xmtp/group/user/wallet/token/...); tab
 *      roots and the accounts overlay are skipped (re-opening on Home is the
 *      expected default, and tab state is cheap to re-derive).
 *    - Hydration failure (corrupt value, missing key) → no-op, default route.
 *    - Restore is attempted ONCE per launch (a ref guards re-entry). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

/** Routes we never restore TO — landing on a tab root or the accounts sheet on
 *  cold start is the intended default. */
function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (/^\/\(tabs\)/.test(path)) return false;
  const TAB_ROOTS = ['/wallet', '/notifications', '/profile', '/settings'];
  if (TAB_ROOTS.includes(path)) return false;
  return true;
}

function persist(path: string): void {
  void AsyncStorage.setItem(STORAGE_KEY, path).catch(() => { /* best-effort */ });
}

/** Whether the cold-start launch URL addresses a real screen (so the deep link
 *  should win and we must NOT restore over it). A bare app-open (no URL, or a
 *  URL with no route segments) is not a deep link. */
function hasColdStartDeepLink(url: string | null): boolean {
  if (!url) return false;
  // Cheap, scheme-agnostic check: any path/hash segment beyond the host means
  // the link points somewhere. Mirrors deepLinks.routeForUrl's "segments > 0".
  const hash = url.indexOf('#');
  const body = hash !== -1 ? url.slice(hash + 1) : url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?]*/i, '');
  return /[a-z0-9]/i.test(body.replace(/^\/+/, '').split(/[?#]/)[0] ?? '');
}

export interface RestoreGate {
  /** False until the one-time load (saved route + launch URL) has resolved. The
   *  root layout renders its boot spinner while this is false so the Stack -
   *  and Home - never mount before the restore decision is known. */
  ready: boolean;
}

/** Root-layout gate + restore driver. Mounted ONCE in the root layout. Holds
 *  the boot spinner until the saved route loads, restores it synchronously when
 *  ready (no Home flash, no timer), then keeps the saved route in sync as the
 *  user navigates. Returns `{ ready }` for the boot-spinner gate. */
export function useRestoreGate(): RestoreGate {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const restoreTried = useRef(false);
  /** Resolved on the one-time load; null = nothing to restore. */
  const savedRoute = useRef<string | null>(null);

  // One-time load: read the saved route AND the cold-start launch URL, then
  // flip `ready` so the Stack mounts. Done before first Stack mount → no flash.
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [saved, initialUrl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          Linking.getInitialURL().catch(() => null),
        ]);
        // A recognised cold-start deep link wins → don't restore over it.
        if (saved && isRestorable(saved) && !hasColdStartDeepLink(initialUrl)) {
          savedRoute.current = saved;
        }
      } catch { /* fall back to the default route on any failure */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Restore synchronously on the first render after `ready`: the Stack has just
  // mounted at the (tabs) root, so a PUSH lands the detail screen on top with
  // the tab beneath it (see the back-stack note above). Runs once.
  useEffect(() => {
    if (!ready || restoreTried.current) return;
    restoreTried.current = true;
    const saved = savedRoute.current;
    if (saved) router.push(saved as Parameters<typeof router.push>[0]);
  }, [ready]);

  // Keep the saved route current. Only persist after the gate is ready so we
  // don't overwrite the saved value with the boot-time root before we've read +
  // restored it.
  useEffect(() => {
    if (!ready) return;
    persist(pathname);
  }, [ready, pathname]);

  return { ready };
}
