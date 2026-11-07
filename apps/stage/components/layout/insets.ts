import { useSafeAreaInsets } from './safeArea';

const NATIVE_BOTTOM_GAP = 96;

export function useFloatingBottom(): number {
  return useSafeAreaInsets().bottom + NATIVE_BOTTOM_GAP;
}

export function useWindowTopInset(): number {
  return useSafeAreaInsets().top;
}

export function useListBottomInset(): number {
  return useSafeAreaInsets().bottom;
}
