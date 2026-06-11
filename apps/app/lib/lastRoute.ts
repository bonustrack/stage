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
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

/** Routes we never restore TO — landing on a tab root or the accounts sheet on
 *  cold start is the intended default. */
function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (/^\/\(tabs\)/.test(path)) return false;
  const TAB_ROOTS = ['/wallet', '/settings'];
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
 *  the boot spinner until the saved route loads, restores it once when ready
 *  (Home underneath → swipe-back pops to Home, no late re-fire), then keeps the
 *  saved route in sync as the user navigates. Returns `{ ready }` for the
 *  boot-spinner gate.
 *
 *  WHY THE PREVIOUS VERSION RE-FIRED + BROKE SWIPE-BACK: it issued
 *  `router.push(saved)` from a post-mount effect BEFORE the root navigator had
 *  finished mounting, so expo-router QUEUED the push and flushed it ~0.5s later.
 *  Two symptoms followed: (a) the pushed card hadn't settled with `(tabs)`
 *  reliably beneath it on the first frame, so the edge-swipe had nothing to pop
 *  to; (b) if the user pressed back to Home before the queued push flushed, the
 *  late push yanked them back to the channel. The `restoreTried` ref guarded
 *  re-ENTRY of the effect but did nothing about an already-queued navigation,
 *  and the persisted value was never consumed, so the trigger survived.
 *
 *  FIX: (1) CONSUME the saved value at read time (delete the key) so it is a
 *  strictly one-shot cold-start trigger — backgrounding/foregrounding or any
 *  remount can never re-arm it. (2) Defer the push to the next frame via
 *  `requestAnimationFrame` so the `(tabs)` root has committed and the navigator
 *  is mounted: the push lands ON TOP of `(tabs)` (Home beneath → swipe-back +
 *  hardware back pop cleanly to Home) and is NOT queued/flushed late. (3) Only
 *  start persisting the live pathname AFTER the restore push has been issued, so
 *  the boot-time `/` doesn't clobber the saved channel before we read it, and so
 *  a user-initiated back-to-Home overwrites the saved route with a
 *  non-restorable root for the rest of the session. */
export function useRestoreGate(): RestoreGate {
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const [ready, setReady] = useState(false);
  const restoreTried = useRef(false);
  /** Flips true once the restore push has been issued (or skipped). Persisting
   *  the live pathname is gated on this so the boot-time root can't clobber the
   *  saved channel before we've read + restored it. */
  const restoreDone = useRef(false);
  /** Resolved on the one-time load; null = nothing to restore. */
  const savedRoute = useRef<string | null>(null);

  // One-time load: read the saved route AND the cold-start launch URL, then
  // flip `ready` so the Stack mounts. Done before first Stack mount → no flash.
  // The saved value is CONSUMED (deleted) here so it can only ever trigger one
  // cold-start restore — a remount / foreground can't re-arm it.
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [saved, initialUrl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          Linking.getInitialURL().catch(() => null),
        ]);
        // Consume immediately: a one-shot cold-start trigger, never re-armable.
        if (saved) void AsyncStorage.removeItem(STORAGE_KEY).catch(() => { /* best-effort */ });
        // A recognised cold-start deep link wins → don't restore over it.
        if (saved && isRestorable(saved) && !hasColdStartDeepLink(initialUrl)) {
          savedRoute.current = saved;
        }
      } catch { /* fall back to the default route on any failure */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Restore once the ROOT NAVIGATOR has actually committed its `(tabs)` root.
  //
  // The previous double-rAF fired too early: on a cold start the root Stack's
  // navigation state isn't populated for the first couple of frames, so the
  // deferred `router.push` landed while the navigator still had ZERO routes
  // (`router.canGoBack()` === false at push time — confirmed on-device). expo-
  // router then reconciled `(tabs)` as the configured initial route AFTER the
  // push, so the hardware/header back still found Home beneath it — but the
  // @react-navigation/stack INTERACTIVE swipe-back pan is wired per-card at the
  // moment the card enters a stack that already has a card beneath it. Pushed
  // onto an empty stack, the restored card never got the gesture responder, so
  // the edge-swipe did nothing (while back worked). That is the exact split Less
  // saw.
  //
  // FIX: gate the push on the ROOT CARD STACK having committed its `(tabs)`
  // entry. `useRootNavigationState()` exposes the expo-router `__root` wrapper
  // first; the actual card stack (where the restored detail screen is pushed and
  // where the swipe-back gesture lives) is its NESTED navigator. We only push
  // once that nested stack reports the `(tabs)` route, so the detail card enters
  // a stack that ALREADY has the tab beneath it → `canGoBack()` true AND the
  // @react-navigation/stack interactive pan responder is wired (swipe-back
  // works). Strictly one-shot via `restoreTried`.
  useEffect(() => {
    if (!ready || restoreTried.current) return;
    const saved = savedRoute.current;
    if (!saved) { restoreTried.current = true; restoreDone.current = true; return; }
    // Find the card stack that holds `(tabs)`: it's either the root state itself
    // or its nested `state` (expo-router wraps everything under a `__root`).
    const stackHasTabs = (s?: { routes?: { name: string; state?: unknown }[] }): boolean =>
      Array.isArray(s?.routes) && s!.routes.some((r) => r.name === '(tabs)');
    const rootHasTabs =
      stackHasTabs(navState) ||
      (Array.isArray(navState?.routes) &&
        navState!.routes.some((r: { state?: { routes?: { name: string }[] } }) => stackHasTabs(r.state)));
    if (!rootHasTabs) return;
    restoreTried.current = true;
    // One frame of slack so the committed `(tabs)` card has painted before the
    // push enters the stack on top of it.
    const raf = requestAnimationFrame(() => {
      router.push(saved as Parameters<typeof router.push>[0]);
      restoreDone.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, navState]);

  // Keep the saved route current — but only AFTER the restore push has been
  // issued, so the boot-time root can't overwrite the saved channel, and a
  // user-initiated back-to-Home persists `/` (non-restorable) for next launch.
  useEffect(() => {
    if (!ready || !restoreDone.current) return;
    persist(pathname);
  }, [ready, pathname]);

  return { ready };
}
