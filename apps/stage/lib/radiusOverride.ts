

import { appStorage } from '../platform/storage';
import {
  BUTTON_RADIUS_DEFAULT, BLOCK_RADIUS_DEFAULT, RADIUS_MIN, RADIUS_MAX,
} from '@stage-labs/kit/tokens';

const BUTTON_KEY = 'theme:radiusOverride';
const BLOCK_KEY = 'theme:blockRadiusOverride';

function clampRadius(n: number): number {
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(n)));
}

let buttonCache: number | null = null;
let blockCache: number | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

export function loadRadius(): void {
  if (loaded) return;
  loaded = true;
  void appStorage.multiGet([BUTTON_KEY, BLOCK_KEY])
    .then((pairs) => {
      let changed = false;
      for (const [key, raw] of pairs) {
        if (raw == null || raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        if (key === BUTTON_KEY) { buttonCache = clampRadius(n); changed = true; }
        else if (key === BLOCK_KEY) { blockCache = clampRadius(n); changed = true; }
      }
      if (changed) emit();
    })
    .catch(() => undefined);
}

export function getRadius(): number { return buttonCache ?? BUTTON_RADIUS_DEFAULT; }
export function getBlockRadius(): number { return blockCache ?? BLOCK_RADIUS_DEFAULT; }


export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
