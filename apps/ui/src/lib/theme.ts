/**
 * @file Reactive, localStorage-persisted app theme preference ('light' | 'dark' | 'system') with a module-level pub/sub to keep components in sync.
 */

import { ref, onUnmounted, type Ref } from 'vue';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@metro-labs/kit/theme';

export type { ThemePreference };

/** Get the Initial. */
function loadInitial(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(v)) return v;
  } catch { /* localStorage may be blocked — fall back */ }
  return 'system';
}

let cached: ThemePreference = loadInitial();
const listeners = new Set<(p: ThemePreference) => void>();

/** Emit helper. */
function emit(p: ThemePreference): void {
  cached = p;
  for (const l of listeners) l(p);
}

/** Persist + broadcast a new theme preference. */
export function setThemePreference(p: ThemePreference): void {
  if (!isThemePreference(p)) return;
  emit(p);
  try { localStorage.setItem(STORAGE_KEY, p); } catch { /* best-effort */ }
}

/** Reactive ref reflecting the current preference. Auto-unsubscribes on unmount. */
export function useThemePreference(): Ref<ThemePreference> {
  const r = ref<ThemePreference>(cached);
  /** Fn helper. */
  const fn = (p: ThemePreference): void => { r.value = p; };
  listeners.add(fn);
  onUnmounted(() => { listeners.delete(fn); });
  return r;
}

const systemDark = ref(typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  /** Older Safari uses `addListener`; modern browsers ignore the deprecated alias. `addEventListener('change', …)` is the wide-compat path. */
  mq.addEventListener('change', e => { systemDark.value = e.matches; });
}

/** Sync the `<html>` element's `dark` class with the effective scheme. Called once at app boot (see main.ts) so Tailwind's `dark:` variants flip live. */
export function installThemeClassEffect(): void {
  /** Update helper. */
  const update = (): void => {
    if (typeof document === 'undefined') return;
    const effective: 'light' | 'dark' = cached === 'system'
      ? (systemDark.value ? 'dark' : 'light')
      : cached;
    document.documentElement.classList.toggle('dark', effective === 'dark');
  };
  listeners.add(update);
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
  }
  update();
}
