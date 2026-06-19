/** @file Cold-start route restore: persists the live route to AsyncStorage and re-navigates there on launch (Home beneath, no flash), with deep-link precedence and once-per-process guards. */

/*
 * Restore-last-screen: persist the current route to AsyncStorage on every
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
 *  the onboarding idiom (the account gate): the root layout holds its boot
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
 *    - Restore is attempted ONCE per launch (a ref guards re-entry).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

/**
 * PROCESS-LEVEL restore state. The root layout (and therefore this hook)
 *  REMOUNTS several times on a real device during heavy boot (xmtp client +
 *  Railgun node settling) — Less's on-device trace showed 3 mounts, the last
 *  ~10s in. Component-scoped refs reset on every remount, so each remount
 *  re-ran the gate and fired a SECOND restore. Hoisting the decision to module
 *  scope makes restore strictly once-per-process: remounts read this and bail.
 *    idle      → no gate has run yet this process
 *    restoring → gate decided to restore; push in flight / waiting on navstate
 *    done      → restore issued (or skipped); never run the gate again
 */
let restoreState: 'idle' | 'restoring' | 'done' = 'idle';

/** The route resolved by the FIRST gate run this process (null = nothing to restore). Held at module scope so a remount mid-restore reuses it instead of re-reading (the key is already consumed/deleted by then anyway). */
let processSavedRoute: string | null = null;

/**
 * The route we restored TO this process. Persistence stays SUSPENDED until the
 *  live pathname moves AWAY from this at least once (a real user navigation).
 *  This is the second half of the bug: the post-restore persist effect saw the
 *  restored channel as the live pathname and wrote it straight back to storage,
 *  so the next remount's gate read hasSaved=true and restored AGAIN. We must
 *  NOT re-persist the restored target.
 */
let restoredTarget: string | null = null;

/** Flips true once a real navigation has moved the pathname away from `restoredTarget`; only then does persistence resume for a restore launch. For a NORMAL open (no restore) this starts effectively true (see below). */
let persistResumed = false;

/**
 * For a restore launch: have we actually OBSERVED the pathname settle ON the
 *  restored target yet? Persistence may only resume on a move AWAY from the
 *  target, but during boot the pathname is the transient `/` BEFORE the push
 *  lands — resuming there would persist `/`, then the subsequent settle on the
 *  target would re-persist the channel (the exact loop). So we require the
 *  target to have been reached first; only a move away AFTER that resumes.
 */
let reachedTarget = false;

/** Routes we never restore TO — landing on a tab root or the accounts sheet on cold start is the intended default. */
function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (path.startsWith("/(tabs)")) return false;
  const TAB_ROOTS = ['/wallet', '/settings'];
  if (TAB_ROOTS.includes(path)) return false;
  return true;
}

/** Persist helper. */
function persist(path: string): void {
  void AsyncStorage.setItem(STORAGE_KEY, path).catch(() => { /* best-effort */ });
}

/** Whether the cold-start launch URL addresses a real screen (so the deep link should win and we must NOT restore over it). A bare app-open (no URL, or a URL with no route segments) is not a deep link. */
function hasColdStartDeepLink(url: string | null): boolean {
  if (!url) return false;
  // Cheap, scheme-agnostic check: any path/hash segment beyond the host means
  // the link points somewhere. Mirrors deepLinks.routeForUrl's "segments > 0".
  const hash = url.indexOf('#');
  const body = hash !== -1 ? url.slice(hash + 1) : url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?]*/i, '');
  return /[a-z0-9]/i.test(body.replace(/^\/+/, '').split(/[?#]/)[0] ?? '');
}

export interface RestoreGate {
  /** False until the one-time load (saved route + launch URL) has resolved. The root layout renders its boot spinner while this is false so the Stack - and Home - never mount before the restore decision is known. */
  ready: boolean;
}

/**
 * Root-layout gate + restore driver. Mounted ONCE in the root layout. Holds
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
 *  non-restorable root for the rest of the session.
 */
export function useRestoreGate(): RestoreGate {
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const [ready, setReady] = useState(false);

  // One-time-PER-PROCESS load: read the saved route AND the cold-start launch
  // URL, then flip `ready` so the Stack mounts. Done before first Stack mount →
  // no flash. The saved value is CONSUMED (deleted) here. Critically, the whole
  // gate is guarded by the module-level `restoreState`: a layout REMOUNT (which
  // happens 3x on Less's device as heavy init settles) re-runs this hook, but
  // the gate body only executes while `restoreState === 'idle'`. On any later
  // mount it short-circuits to ready and records that the process guard blocked
  // it — so the restore can NEVER fire twice in one process.
  useEffect(() => {
    let cancelled = false;
    // Remount after the gate already ran: do NOT re-read or re-arm. Just unblock
    // the Stack.
    if (restoreState !== 'idle') {
      setReady(true);
      return;
    }
    void (async (): Promise<void> => {
      try {
        const [saved, initialUrl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          Linking.getInitialURL().catch(() => null),
        ]);
        // Consume immediately: a one-shot cold-start trigger, never re-armable.
        if (saved) void AsyncStorage.removeItem(STORAGE_KEY).catch(() => { /* best-effort */ });
        // A recognised cold-start deep link wins → don't restore over it.
        const deepLink = hasColdStartDeepLink(initialUrl);
        const restorable = !!saved && isRestorable(saved);
        const willRestore = !!saved && restorable && !deepLink;
        if (willRestore) {
          processSavedRoute = saved;
          restoredTarget = saved;
          persistResumed = false; // suspend persistence until user navigates away
          reachedTarget = false;
          restoreState = 'restoring';
        } else {
          // Nothing to restore → a normal open. Persist as today, immediately.
          persistResumed = true;
          restoreState = 'done';
        }
      } catch {
        persistResumed = true;
        restoreState = 'done';
      }
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
    if (!ready || restoreState !== 'restoring') return;
    const saved = processSavedRoute;
    if (!saved) { restoreState = 'done'; persistResumed = true; return; }
    // Find the card stack that holds `(tabs)`: it's either the root state itself
    // or its nested `state` (expo-router wraps everything under a `__root`).
    /** Stack Has Tabs. */
    const stackHasTabs = (s?: { routes?: { name: string; state?: unknown }[] }): boolean =>
      Array.isArray(s?.routes) && s.routes.some((r) => r.name === '(tabs)');
    const rootHasTabs =
      stackHasTabs(navState) ||
      (Array.isArray(navState?.routes) &&
        navState.routes.some((r: { state?: { routes?: { name: string }[] } }) => stackHasTabs(r.state)));
    if (!rootHasTabs) return;
    // Claim the restore for this process BEFORE the async push so a concurrent
    // remount's effect can't also pass the guard and double-push.
    restoreState = 'done';
    // One frame of slack so the committed `(tabs)` card has painted before the
    // push enters the stack on top of it.
    const raf = requestAnimationFrame(() => {
      router.push(saved);
    });
    return () => { cancelAnimationFrame(raf); };
  }, [ready, navState]);

  // Keep the saved route current — but NEVER re-persist the route we just
  // restored TO. The persist effect only resumes once a REAL user navigation has
  // moved the pathname away from `restoredTarget` (tracked at module scope so it
  // survives remounts). For a normal open (no restore) `persistResumed` is true
  // from the gate, so this behaves exactly as before. This is what stops the
  // restored channel being written straight back to storage and re-restored on
  // the next layout remount ~10s into boot.
  useEffect(() => {
    if (!ready) return;
    if (!persistResumed) {
      const onTarget = !!restoredTarget && pathname === restoredTarget;
      if (onTarget) {
        // The restore push landed: remember we reached the target, but do NOT
        // persist it (that write is what caused the re-restore loop). Wait for a
        // move away.
        reachedTarget = true;
        return;
      }
      // Before the target is reached, the pathname is the boot transient `/` —
      // ignore it entirely (don't resume, don't persist) so we never write `/`
      // and then re-write the channel once it settles.
      if (!reachedTarget) return;
      // Target was reached and the user has now navigated AWAY → resume.
      persistResumed = true;
    }
    persist(pathname);
  }, [ready, pathname]);

  return { ready };
}
