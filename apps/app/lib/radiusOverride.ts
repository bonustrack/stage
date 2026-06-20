/** @file Device-local persisted override store for the two corner-radius design tokens (button pill + block container), with synchronous getters and pub/sub for the Kit editor and theme. */

/** Persisted corner radii (button pill default 999, block container default 12); mirrors colorOverrides.ts with in-memory cache + AsyncStorage + pub/sub, edited by the Kit editor and read reactively by theme.ts. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BUTTON_RADIUS_DEFAULT, BLOCK_RADIUS_DEFAULT, RADIUS_MIN, RADIUS_MAX,
} from '@stage-labs/kit/tokens';

const BUTTON_KEY = 'theme:radiusOverride'; /** legacy key kept → no migration needed */
const BLOCK_KEY = 'theme:blockRadiusOverride';

/** Clamp + round any input into the valid [MIN, MAX] integer range. */
function clamp(n: number, def: number): number {
  if (!Number.isFinite(n)) return def;
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(n)));
}
/** Clamp Radius. */
function clampRadius(n: number): number { return clamp(n, BUTTON_RADIUS_DEFAULT); }
/** Clamp Block Radius. */
function clampBlockRadius(n: number): number { return clamp(n, BLOCK_RADIUS_DEFAULT); }

/** In-memory mirrors so the hooks can read synchronously after the one-time load, and edits repaint instantly. `null` = no override → use the default. */
let buttonCache: number | null = null;
let blockCache: number | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/** Emit helper. */
function emit(): void { for (const l of listeners) l(); }

/** Kick off the one-time load from storage; notify subscribers when it lands. */
export function loadRadius(): void {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.multiGet([BUTTON_KEY, BLOCK_KEY])
    .then((pairs) => {
      let changed = false;
      for (const [key, raw] of pairs) {
        if (raw == null || raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        if (key === BUTTON_KEY) { buttonCache = clampRadius(n); changed = true; }
        else if (key === BLOCK_KEY) { blockCache = clampBlockRadius(n); changed = true; }
      }
      if (changed) emit();
    })
    .catch(() => { /** best-effort: keep defaults */ });
}

/** Synchronous snapshot of the effective button radius (override or default). */
export function getRadius(): number { return buttonCache ?? BUTTON_RADIUS_DEFAULT; }
/** Synchronous snapshot of the effective block radius (override or default). */
export function getBlockRadius(): number { return blockCache ?? BLOCK_RADIUS_DEFAULT; }


/** Subscribe to radius changes (load/edit/reset). Returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
