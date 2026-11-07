import { useBottomChromeHeight } from './bottomChrome';
import { PAGE_GUTTER } from './gutter';
import { useSafeAreaInsets } from './safeArea';
import { desktopTitleBarInset } from './webLayout';

export function useFloatingBottom(): number {
  const insets = useSafeAreaInsets();
  const chrome = useBottomChromeHeight();
  return Math.max(insets.bottom, chrome) + PAGE_GUTTER;
}

export function useWindowTopInset(): number {
  return desktopTitleBarInset();
}

export function useListBottomInset(): number {
  return useSafeAreaInsets().bottom + useBottomChromeHeight();
}
