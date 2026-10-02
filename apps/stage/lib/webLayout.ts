import { Platform, useWindowDimensions } from 'react-native';
import { useCallMinimized } from './calls.store';

const WEB_SIDEBAR_MIN_WIDTH = 1100;
const WEB_TOP_BAND = 12;

export const WEB_TAB_RAIL_WIDTH = 72;
export const CALL_BAR_HEIGHT = 44;

interface DesktopBridge { titleBarInset?: unknown }

function desktopBridge(): DesktopBridge | undefined {
  return (globalThis as { stageDesktop?: DesktopBridge }).stageDesktop;
}

export function desktopTitleBarInset(): number {
  if (Platform.OS !== 'web') return 0;
  const inset = desktopBridge()?.titleBarInset;
  return typeof inset === 'number' && Number.isFinite(inset) && inset > 0 ? inset : 0;
}

export function isCoarsePointer(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function documentScroll(): { x: number; y: number } {
  if (Platform.OS !== 'web') return { x: 0, y: 0 };
  return { x: window.scrollX, y: window.scrollY };
}

export function useWebTabRail(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
}

export function useTopBandInset(): number {
  const wide = useWebTabRail();
  const desktop = desktopTitleBarInset();
  if (desktop > 0) return desktop;
  return wide ? WEB_TOP_BAND : 0;
}

export function useTopChromeInset(): number {
  const band = useTopBandInset();
  return useCallMinimized() ? band + CALL_BAR_HEIGHT : band;
}

let scrollLocks = 0;

export function lockDocumentScroll(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => undefined;
  scrollLocks += 1;
  document.documentElement.classList.add('stage-scroll-locked');
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.documentElement.classList.remove('stage-scroll-locked');
  };
}
