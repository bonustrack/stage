

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'metro:lastRoute:v1';

let restoreState: 'idle' | 'restoring' | 'done' = 'idle';

let processSavedRoute: string | null = null;

let restoredTarget: string | null = null;

let persistResumed = false;

let reachedTarget = false;

function isRestorable(path: string): boolean {
  if (!path || path === '/') return false;
  if (path === '/accounts') return false;
  if (path.startsWith('/(tabs)')) return false;
  const TAB_ROOTS = ['/wallet', '/settings'];
  if (TAB_ROOTS.includes(path)) return false;
  return true;
}

function persist(path: string): void {
  void AsyncStorage.setItem(STORAGE_KEY, path).catch(() => undefined);
}

function hasColdStartDeepLink(url: string | null): boolean {
  if (!url) return false;
  const hash = url.indexOf('#');
  const body = hash !== -1 ? url.slice(hash + 1) : url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?]*/i, '');
  return /[a-z0-9]/i.test(body.replace(/^\/+/, '').split(/[?#]/)[0] ?? '');
}

export interface RestoreGate {
  ready: boolean;
}

export function useRestoreGate(): RestoreGate {
  const pathname = usePathname();
  const navState = useRootNavigationState();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
        if (saved) void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
        const deepLink = hasColdStartDeepLink(initialUrl);
        const restorable = !!saved && isRestorable(saved);
        const willRestore = !!saved && restorable && !deepLink;
        if (willRestore) {
          processSavedRoute = saved;
          restoredTarget = saved;
          persistResumed = false;
          reachedTarget = false;
          restoreState = 'restoring';
        } else {
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

  useEffect(() => {
    if (!ready || restoreState !== 'restoring') return;
    const saved = processSavedRoute;
    if (!saved) { restoreState = 'done'; persistResumed = true; return; }
    const stackHasTabs = (s?: { routes?: { name: string; state?: unknown }[] }): boolean =>
      Array.isArray(s?.routes) && s.routes.some((r) => r.name === '(tabs)');
    const rootHasTabs =
      stackHasTabs(navState) ||
      (Array.isArray(navState?.routes) &&
        navState.routes.some((r: { state?: { routes?: { name: string }[] } }) => stackHasTabs(r.state)));
    if (!rootHasTabs) return;
    restoreState = 'done';
    const raf = requestAnimationFrame(() => {
      router.push(saved);
    });
    return () => { cancelAnimationFrame(raf); };
  }, [ready, navState]);

  useEffect(() => {
    if (!ready) return;
    if (!persistResumed) {
      const onTarget = !!restoredTarget && pathname === restoredTarget;
      if (onTarget) {
        reachedTarget = true;
        return;
      }
      if (!reachedTarget) return;
      persistResumed = true;
    }
    persist(pathname);
  }, [ready, pathname]);

  return { ready };
}
