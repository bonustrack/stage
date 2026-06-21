
import { ref, computed, onUnmounted, type Ref } from 'vue';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@stage-labs/kit/theme';

export type { ThemePreference };

function loadInitial(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(v)) return v;
  } catch { }
  return 'system';
}

let cached: ThemePreference = loadInitial();
const listeners = new Set<(p: ThemePreference) => void>();

function emit(p: ThemePreference): void {
  cached = p;
  for (const l of listeners) l(p);
}

export function setThemePreference(p: ThemePreference): void {
  if (!isThemePreference(p)) return;
  emit(p);
  try { localStorage.setItem(STORAGE_KEY, p); } catch { }
}

export function useThemePreference(): Ref<ThemePreference> {
  const r = ref<ThemePreference>(cached);
  const fn = (p: ThemePreference): void => { r.value = p; };
  listeners.add(fn);
  onUnmounted(() => { listeners.delete(fn); });
  return r;
}

const systemDark = ref(typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', e => { systemDark.value = e.matches; });
}

export const systemScheme = computed<'light' | 'dark'>(() => systemDark.value ? 'dark' : 'light');

export function installThemeClassEffect(): void {
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
