import { makeListeners, useStoreValue } from '../../lib/storeCore';
import { WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { namespacedKey, readNamespaced } from '../../platform/storageNamespace';

const DEFAULT_PANE_WIDTH = 380;
const MIN_PANE_WIDTH = 280;
const MAX_PANE_WIDTH = 600;
const STORAGE_KEY = 'web.channelsPaneWidth';
const STYLE_ID = 'stage-pane-width';

const listeners = makeListeners();

function clampPaneWidth(w: number): number {
  return Math.min(MAX_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, w));
}

function readInitial(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_PANE_WIDTH;
  const raw = Number(readNamespaced(localStorage, STORAGE_KEY));
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
  el.textContent = `[data-stagepane="1"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH + width}px; }`
    + ` [data-stagepane="rail"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH}px; }`;
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
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(namespacedKey(STORAGE_KEY), String(w));
  }
  listeners.notify();
}

export function resetPaneWidth(): void {
  setPaneWidth(DEFAULT_PANE_WIDTH);
}

export function usePaneWidth(): number {
  return useStoreValue(listeners.subscribe, getPaneWidth);
}
