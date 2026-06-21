import { computed, type ComputedRef } from 'vue';
import { useThemePreference, systemScheme } from './theme';

export function useEffectiveScheme(): ComputedRef<'light' | 'dark'> {
  const pref = useThemePreference();
  return computed<'light' | 'dark'>(() =>
    pref.value === 'system'
      ? (systemScheme.value === 'dark' ? 'dark' : 'light')
      : pref.value,
  );
}
