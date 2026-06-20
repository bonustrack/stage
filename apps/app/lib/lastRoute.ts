/** @file Cold-start route restore: persists the live route to AsyncStorage and re-navigates there on launch (Home beneath, no flash), with deep-link precedence and once-per-process guards. */

/** Persist the live route to AsyncStorage and restore detail routes on cold launch via router.push (Home beneath, no flash), with deep-link precedence, once-per-process guards, and skips for tab roots and corrupt values. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

/** Process-level restore state (idle/restoring/done) hoisted to module scope so the layout's several boot remounts read it and bail instead of each firing a second restore. */
let restoreState: 'idle' | 'restoring' | 'done' = 'idle';

/** The route resolved by the FIRST gate run this process (null = nothing to restore). Held at module scope so a remount mid-restore reuses it instead of re-reading (the key is already consumed/deleted by then anyway). */
let processSavedRoute: string | null = null;

/** The route restored TO this process; persistence stays suspended until the pathname moves away from it once, else the persist effect would re-write it and trigger a re-restore loop. */
let restoredTarget: string | null = null;

/** Flips true once a real navigation has moved the pathname away from `restoredTarget`; only then does persistence resume for a restore launch. For a NORMAL open (no restore) this starts effectively true (see below). */
let persistResumed = false;

/** For a restore launch, whether the pathname has settled ON the target yet: resume requires the target reached first, since the boot transient `/` would otherwise persist and re-trigger the loop. */
let reachedTarget = false;

/** Routes we never restore TO — landing on a tab root or the accounts sheet on cold start is the intended default. */
function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (path.startsWith('/(tabs)')) return false;
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
  /** Cheap scheme-agnostic check: any path/hash segment beyond the host means the link points somewhere (mirrors deepLinks.routeForUrl's "segments > 0"). */
  const hash = url.indexOf('#');
  const body = hash !== -1 ? url.slice(hash + 1) : url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?]*/i, '');
  return /[a-z0-9]/i.test(body.replace(/^\/+/, '').split(/[?#]/)[0] ?? '');
}

export interface RestoreGate {
  /** False until the one-time load (saved route + launch URL) has resolved. The root layout renders its boot spinner while this is false so the Stack - and Home - never mount before the restore decision is known. */
  ready: boolean;
}

/** Root-layout gate + restore driver (mounted once): holds the boot spinner until the saved route loads, then consumes it and defers a one-shot router.push to the next frame so Home sits beneath (swipe-back works), persisting the live pathname only after the push. */
export function useRestoreGate(): RestoreGate {
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const [ready, setReady] = useState(false);

  /** One-time-per-process load of the saved route + cold-start launch URL before first Stack mount (no flash), consuming the saved value and guarded by module-level `restoreState` so a layout remount can't fire restore twice. */
  useEffect(() => {
    let cancelled = false;
    /** Remount after the gate already ran: do NOT re-read or re-arm, just unblock the Stack. */
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
        /** Consume immediately: a one-shot cold-start trigger, never re-armable. */
        if (saved) void AsyncStorage.removeItem(STORAGE_KEY).catch(() => { /* best-effort */ });
        /** A recognised cold-start deep link wins → don't restore over it. */
        const deepLink = hasColdStartDeepLink(initialUrl);
        const restorable = !!saved && isRestorable(saved);
        const willRestore = !!saved && restorable && !deepLink;
        if (willRestore) {
          processSavedRoute = saved;
          restoredTarget = saved;
          persistResumed = false; /** suspend persistence until user navigates away */
          reachedTarget = false;
          restoreState = 'restoring';
        } else {
          /** Nothing to restore → a normal open. Persist as today, immediately. */
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

  /** Gate the restore push on the nested root CARD stack having committed its `(tabs)` entry (not just expo-router's `__root` wrapper) so the detail card enters a stack with the tab beneath it, wiring the swipe-back pan responder; one-shot. */
  useEffect(() => {
    if (!ready || restoreState !== 'restoring') return;
    const saved = processSavedRoute;
    if (!saved) { restoreState = 'done'; persistResumed = true; return; }
    /** Find the card stack holding `(tabs)`: either the root state itself or its nested `state` (expo-router wraps everything under a `__root`). */
    const stackHasTabs = (s?: { routes?: { name: string; state?: unknown }[] }): boolean =>
      Array.isArray(s?.routes) && s.routes.some((r) => r.name === '(tabs)');
    const rootHasTabs =
      stackHasTabs(navState) ||
      (Array.isArray(navState?.routes) &&
        navState.routes.some((r: { state?: { routes?: { name: string }[] } }) => stackHasTabs(r.state)));
    if (!rootHasTabs) return;
    /** Claim the restore for this process BEFORE the async push so a concurrent remount's effect can't also pass the guard and double-push. */
    restoreState = 'done';
    /** One frame of slack so the committed `(tabs)` card has painted before the push enters the stack on top of it. */
    const raf = requestAnimationFrame(() => {
      router.push(saved);
    });
    return () => { cancelAnimationFrame(raf); };
  }, [ready, navState]);

  /** Keep the saved route current but never re-persist the just-restored target; the persist effect resumes only once a real navigation moves the pathname away from `restoredTarget`, stopping the re-restore loop. */
  useEffect(() => {
    if (!ready) return;
    if (!persistResumed) {
      const onTarget = !!restoredTarget && pathname === restoredTarget;
      if (onTarget) {
        /** The restore push landed: remember we reached the target but do NOT persist it (that write caused the re-restore loop); wait for a move away. */
        reachedTarget = true;
        return;
      }
      /** Before the target is reached the pathname is the boot transient `/` — ignore it entirely (don't resume, don't persist) so we never write `/` then re-write the channel once it settles. */
      if (!reachedTarget) return;
      /** Target was reached and the user has now navigated AWAY → resume. */
      persistResumed = true;
    }
    persist(pathname);
  }, [ready, pathname]);

  return { ready };
}
