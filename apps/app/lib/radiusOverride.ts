/** Persisted numeric design tokens: two corner radii.
 *
 *  - `button` (button-border-radius) — px applied to every non-circular button.
 *    Default BUTTON_RADIUS_DEFAULT (999 = fully-rounded pill, the original look).
 *  - `block` (border-radius) — px applied to every non-button container surface
 *    (inputs/text fields, cards, modals/sheets, bordered/filled "blocks").
 *    Default BLOCK_RADIUS_DEFAULT (12 = prevailing container look).
 *
 *  Mirrors lib/colorOverrides.ts (in-memory mirror + AsyncStorage persist +
 *  pub/sub) but holds two numbers. The Kit editor edits them; theme.ts reads
 *  them reactively (useRadius / useBlockRadius) and wires the button value into
 *  the kit Button via setDefaultButtonRadius. Device-only. The app renders
 *  identically until the user edits a token. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BUTTON_RADIUS_DEFAULT, BLOCK_RADIUS_DEFAULT, RADIUS_MIN, RADIUS_MAX,
} from '@metro-labs/kit/tokens';

const BUTTON_KEY = 'theme:radiusOverride'; // legacy key kept → no migration needed
const BLOCK_KEY = 'theme:blockRadiusOverride';

/** Clamp + round any input into the valid [MIN, MAX] integer range. */
function clamp(n: number, def: number): number {
  if (!Number.isFinite(n)) return def;
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(n)));
}
export function clampRadius(n: number): number { return clamp(n, BUTTON_RADIUS_DEFAULT); }
export function clampBlockRadius(n: number): number { return clamp(n, BLOCK_RADIUS_DEFAULT); }

/** In-memory mirrors so the hooks can read synchronously after the one-time
 *  load, and edits repaint instantly. `null` = no override → use the default. */
let buttonCache: number | null = null;
let blockCache: number | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

function persist(key: string, v: number | null): void {
  void AsyncStorage.setItem(key, v == null ? '' : String(v)).catch(() => { /* best-effort */ });
}

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
    .catch(() => { /* best-effort: keep defaults */ });
}

/** Synchronous snapshot of the effective button radius (override or default). */
export function getRadius(): number { return buttonCache ?? BUTTON_RADIUS_DEFAULT; }
/** Synchronous snapshot of the effective block radius (override or default). */
export function getBlockRadius(): number { return blockCache ?? BLOCK_RADIUS_DEFAULT; }

/** Set the button radius override (clamped), then persist + notify. */
export function setRadius(n: number): void {
  buttonCache = clampRadius(n);
  emit();
  persist(BUTTON_KEY, buttonCache);
}
/** Set the block radius override (clamped), then persist + notify. */
export function setBlockRadius(n: number): void {
  blockCache = clampBlockRadius(n);
  emit();
  persist(BLOCK_KEY, blockCache);
}

/** Clear BOTH overrides → back to the kit defaults. */
export function resetRadius(): void {
  buttonCache = null;
  blockCache = null;
  emit();
  persist(BUTTON_KEY, null);
  persist(BLOCK_KEY, null);
}

/** Subscribe to radius changes (load/edit/reset). Returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
