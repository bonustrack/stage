import { makeListeners, useStoreValue } from '../../lib/storeCore';
import { WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { namespacedKey, readNamespaced } from '../../platform/storageNamespace';

const MIN_WIDTH_SNAP_PX = 4;

function isMinWidth(width: number, min: number): boolean {
  return width - min <= MIN_WIDTH_SNAP_PX;
}

export interface PaneWidth {
  get: () => number;
  set: (next: number) => void;
  reset: () => void;
  use: () => number;
  useAtMin: () => boolean;
}

interface PaneWidthOptions {
  key: string;
  initial: number;
  min: number;
  max: number;
  styleId: string;
  css: (width: number) => string;
}

function writeStyle(id: string, text: string): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = text;
}

export function createPaneWidth(opts: PaneWidthOptions): PaneWidth {
  const listeners = makeListeners();
  const clamp = (w: number): number => Math.min(opts.max, Math.max(opts.min, w));

  const readInitial = (): number => {
    if (typeof localStorage === 'undefined') return opts.initial;
    const raw = Number(readNamespaced(localStorage, opts.key));
    return Number.isFinite(raw) && raw > 0 ? clamp(raw) : opts.initial;
  };

  let width = readInitial();
  writeStyle(opts.styleId, opts.css(width));

  const get = (): number => width;

  const set = (next: number): void => {
    const w = clamp(Math.round(next));
    if (w === width) return;
    width = w;
    writeStyle(opts.styleId, opts.css(width));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(namespacedKey(opts.key), String(w));
    }
    listeners.notify();
  };

  const use = (): number => useStoreValue(listeners.subscribe, get);
  const atMin = (): boolean => isMinWidth(width, opts.min);
  const useAtMin = (): boolean => useStoreValue(listeners.subscribe, atMin);

  return { get, set, reset: () => { set(opts.initial); }, use, useAtMin };
}

export const channelsPaneWidth = createPaneWidth({
  key: 'web.channelsPaneWidth',
  initial: 380,
  min: 280,
  max: 600,
  styleId: 'stage-pane-width',
  css: (width) => `[data-stagepane="1"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH + width}px; }`
    + ` [data-stagepane="rail"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH}px; }`,
});
