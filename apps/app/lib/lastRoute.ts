/** Restore-last-screen: persist the current route to AsyncStorage on every
 *  navigation and, on a cold launch, return the user to where they left off.
 *
 *  expo-router owns its own NavigationContainer, so there's no public
 *  `initialState` to hand it. The supported, framework-friendly path is to
 *  persist the live `usePathname()` and, after mount, `router.replace` to the
 *  saved location — a pragmatic restore that composes with the existing
 *  NativeSwipeStack + deep-link routing rather than fighting the container.
 *
 *  COORDINATION WITH DEEP LINKS: a deep link (push tap / universal link) resolves
 *  async right after mount and navigates AWAY from the tabs root. The restore only
 *  fires while the app is STILL at the default root: if a deep link already moved
 *  us off root, the live pathname is non-default and we skip — the link wins, no
 *  double-navigate. We also wait ~150ms so `Linking.getInitialURL()` (awaited in
 *  useDeepLinks) lands first.
 *
 *  EDGE HANDLING:
 *    - Only DETAIL routes are restored (xmtp/group/user/wallet/token/...); tab
 *      roots and the accounts overlay are skipped (re-opening on Home is the
 *      expected default, and tab state is cheap to re-derive).
 *    - Hydration failure (corrupt value, missing key) → no-op, default route.
 *    - Restore is attempted ONCE per launch (a ref guards re-entry). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

/** Routes we never restore TO — landing on a tab root or the accounts sheet on
 *  cold start is the intended default. */
function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (/^\/\(tabs\)/.test(path)) return false;
  const TAB_ROOTS = ['/wallet', '/notifications', '/profile', '/search', '/settings'];
  if (TAB_ROOTS.includes(path)) return false;
  return true;
}

function persist(path: string): void {
  void AsyncStorage.setItem(STORAGE_KEY, path).catch(() => { /* best-effort */ });
}

/** Hook mounted once in the root layout. Restores the saved route on launch,
 *  then keeps it in sync as the user navigates. */
export function useRestoreLastRoute(): void {
  const pathname = usePathname();
  const restoreTried = useRef(false);
  const hydrated = useRef(false);
  /** Live mirror so the delayed restore reads the CURRENT route (a deep link may
   *  have navigated during the wait), not the value captured at mount. */
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;
    // ~150ms lets Linking.getInitialURL() (awaited in useDeepLinks) resolve and
    // navigate first on a cold-start deep link, so we never clobber it.
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        if (cancelled || restoreTried.current) return;
        restoreTried.current = true;
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          hydrated.current = true;
          if (cancelled || !saved) return;
          const cur = pathRef.current;
          const atRoot = cur === '/' || /^\/\(tabs\)/.test(cur);
          if (!atRoot) return; // a deep link already moved us off root → it wins
          if (!isRestorable(saved)) return;
          router.replace(saved as Parameters<typeof router.replace>[0]);
        } catch {
          hydrated.current = true; // fall back to the default route on any failure
        }
      })();
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // Keep the saved route current. Only persist after the initial hydration
  // attempt so we don't overwrite the saved value with the boot-time root
  // before we've had a chance to read + restore it.
  useEffect(() => {
    if (!hydrated.current) return;
    persist(pathname);
  }, [pathname]);
}
