
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { WEB_TAB_RAIL_WIDTH } from './useWebTabRail';

const DEFAULT_PANE_WIDTH = 380;
const MIN_PANE_WIDTH = 280;
const MAX_PANE_WIDTH = 600;
const STORAGE_KEY = 'web.channelsPaneWidth';
const STYLE_ID = 'stage-pane-width';

const listeners = new Set<() => void>();

function clampPaneWidth(w: number): number {
  return Math.min(MAX_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, w));
}

function readInitial(): number {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return DEFAULT_PANE_WIDTH;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampPaneWidth(raw) : DEFAULT_PANE_WIDTH;
}

function syncCssVar(): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `[data-stagepane="1"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH + width}px; }`;
}

let width = readInitial();
syncCssVar();

export function getPaneWidth(): number {
  return width;
}

export function setPaneWidth(next: number): void {
  const w = clampPaneWidth(Math.round(next));
  if (w === width) return;
  width = w;
  syncCssVar();
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(w));
  }
  for (const l of listeners) l();
}

export function resetPaneWidth(): void {
  setPaneWidth(DEFAULT_PANE_WIDTH);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function usePaneWidth(): number {
  return useSyncExternalStore(subscribe, getPaneWidth, getPaneWidth);
}
