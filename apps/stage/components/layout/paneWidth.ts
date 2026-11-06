import { createValueStore } from '../../lib/persistedStore';
import { appStorage } from '../../platform/storage';
import { WEB_TAB_RAIL_WIDTH } from './webLayout';

const NOT_KEPT = { get: (): Promise<null> => Promise.resolve(null), set: (): Promise<void> => Promise.resolve() };
const paneStorage = appStorage.getSync ? appStorage : NOT_KEPT;

export interface PaneWidth {
  get: () => number;
  set: (next: number) => void;
  reset: () => void;
  use: () => number;
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
  const clamp = (w: number): number => Math.min(opts.max, Math.max(opts.min, w));
  const store = createValueStore<number>({
    key: opts.key,
    default: opts.initial,
    storage: paneStorage,
    readNow: true,
    deserialize: (raw) => {
      const saved = Number(raw);
      return Number.isFinite(saved) && saved > 0 ? clamp(saved) : undefined;
    },
  });
  writeStyle(opts.styleId, opts.css(store.get()));

  const set = (next: number): void => {
    const w = clamp(Math.round(next));
    if (w === store.get()) return;
    writeStyle(opts.styleId, opts.css(w));
    store.set(w);
  };

  return {
    get: store.get,
    set,
    reset: () => {
      set(opts.initial);
    },
    use: store.use,
  };
}

export const channelsPaneWidth = createPaneWidth({
  key: 'web.channelsPaneWidth',
  initial: 380,
  min: 280,
  max: 600,
  styleId: 'stage-pane-width',
  css: (width) =>
    `[data-stagepane="1"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH + width}px; }` +
    ` [data-stagepane="rail"] { --stage-pane-left: ${WEB_TAB_RAIL_WIDTH}px; }`,
});
