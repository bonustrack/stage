import { Platform } from 'react-native';
import { useBottomChromeHeight } from '../../lib/bottomChrome';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { PAGE_GUTTER } from './gutter';

const NATIVE_BOTTOM_GAP = 96;

export function useFloatingBottom(): number {
  const insets = useSafeAreaInsets();
  const chrome = useBottomChromeHeight();
  return Platform.OS === 'web' ? Math.max(insets.bottom, chrome) + PAGE_GUTTER : insets.bottom + NATIVE_BOTTOM_GAP;
}
