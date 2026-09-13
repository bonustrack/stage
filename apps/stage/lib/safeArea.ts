import { useMemo } from 'react';
import { useSafeAreaInsets as useDeviceInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useTopChromeInset } from './webLayout';

export function useSafeAreaInsets(): EdgeInsets {
  const insets = useDeviceInsets();
  const chrome = useTopChromeInset();
  return useMemo(() => (chrome === 0 ? insets : { ...insets, top: insets.top + chrome }), [insets, chrome]);
}
