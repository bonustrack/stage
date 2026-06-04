/** Persisted numeric design token: the corner `radius` (px) applied to every
 *  non-circular button across the app. Mirrors lib/colorOverrides.ts (in-memory
 *  mirror + AsyncStorage persist + pub/sub) but holds a single number instead of
 *  a per-scheme hex map. The Kit editor edits it; useRadius() reads it reactively
 *  and wires it into the kit Button via setDefaultButtonRadius. Device-only.
 *
 *  Default = RADIUS_DEFAULT (999 = fully-rounded pill, the original look) so the
 *  app renders identically until the user edits the token. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RADIUS_DEFAULT, RADIUS_MIN, RADIUS_MAX } from '@metro-labs/kit/tokens';

const KEY = 'theme:radiusOverride';

/** Clamp + round any input into the valid [MIN, MAX] integer range. */
export function clampRadius(n: number): number {
  if (!Number.isFinite(n)) return RADIUS_DEFAULT;
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(n)));
}

/** In-memory mirror so useRadius can read synchronously after the one-time
 *  load, and edits repaint instantly. `null` = no override → use the default. */
let cache: number | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

function persist(): void {
  const v = cache;
  void AsyncStorage.setItem(KEY, v == null ? '' : String(v)).catch(() => { /* best-effort */ });
}

/** Kick off the one-time load from storage; notify subscribers when it lands. */
export function loadRadius(): void {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw == null || raw === '') return;
      const n = Number(raw);
      if (Number.isFinite(n)) { cache = clampRadius(n); emit(); }
    })
    .catch(() => { /* best-effort: keep default */ });
}

/** Synchronous snapshot of the effective radius (override or default). */
export function getRadius(): number { return cache ?? RADIUS_DEFAULT; }

/** Set the radius override (clamped), then persist + notify. */
export function setRadius(n: number): void {
  cache = clampRadius(n);
  emit();
  persist();
}

/** Clear the override → back to the kit default. */
export function resetRadius(): void {
  cache = null;
  emit();
  persist();
}

/** Subscribe to radius changes (load/edit/reset). Returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
