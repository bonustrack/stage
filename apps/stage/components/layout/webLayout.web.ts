import { useWindowDimensions } from 'react-native';
import { useBottomChromeHeight } from './bottomChrome';
import type { DesktopBridgeGlobal } from '../../lib/desktopBridge';
import { WEB_SIDEBAR_MIN_WIDTH } from './breakpoints';
import { setChromeClass } from './webChrome';

export { WEB_TAB_RAIL_WIDTH } from './webChrome.core';
export { isCoarsePointer } from '@stage-labs/kit/react-native/dom';

const WEB_TOP_BAND = 12;

export function desktopTitleBarInset(): number {
  const inset = (globalThis as DesktopBridgeGlobal).stageDesktop?.titleBarInset;
  return typeof inset === 'number' && Number.isFinite(inset) && inset > 0 ? inset : 0;
}

export function documentScroll(): { x: number; y: number } {
  return { x: window.scrollX, y: window.scrollY };
}

export function useWebTabRail(): boolean {
  const { width } = useWindowDimensions();
  return width >= WEB_SIDEBAR_MIN_WIDTH;
}

export function useTopChromeInset(): number {
  const wide = useWebTabRail();
  const desktop = desktopTitleBarInset();
  if (desktop > 0) return desktop;
  return wide ? WEB_TOP_BAND : 0;
}

export function useContentViewportHeight(): number {
  return useWindowDimensions().height - useTopChromeInset() - useBottomChromeHeight();
}

let scrollLocks = 0;

export function lockDocumentScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  scrollLocks += 1;
  setChromeClass('scroll-locked', true);
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) setChromeClass('scroll-locked', false);
  };
}
