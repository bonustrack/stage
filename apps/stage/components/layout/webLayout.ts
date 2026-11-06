import { useWindowDimensions } from 'react-native';
import { useBottomChromeHeight } from './bottomChrome';

export { WEB_TAB_RAIL_WIDTH } from './webChrome.core';

export function desktopTitleBarInset(): number {
  return 0;
}

export function isCoarsePointer(): boolean {
  return true;
}

export function documentScroll(): { x: number; y: number } {
  return { x: 0, y: 0 };
}

export function useWebTabRail(): boolean {
  return false;
}

export function useTopChromeInset(): number {
  return 0;
}

export function useContentViewportHeight(): number {
  return useWindowDimensions().height - useBottomChromeHeight();
}

export function lockDocumentScroll(): () => void {
  return () => undefined;
}
