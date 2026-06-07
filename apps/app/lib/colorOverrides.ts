/** Per-token, per-scheme color overrides for the 7 canonical palette tokens.
 *  Lets the Kit page edit any token's hex; overrides are layered OVER the kit
 *  defaults by usePalette() and re-theme the whole app live. Device-only,
 *  persisted to AsyncStorage. Same in-memory-mirror + pub/sub pattern as
 *  lastAttachment.ts/scrollPos.ts; no new dependency.
 *
 *  Shape: { [tokenKey]: { light?: hex, dark?: hex } }. tokenKey is one of the
 *  7 Palette keys (bg/border/text/link/primary/danger/success). */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type Scheme = 'light' | 'dark';
export type TokenKey =
  'bg' | 'border' | 'text' | 'link' | 'primary' | 'danger' | 'success'
  | 'inputBg' | 'toolbarBg';

export type ColorOverrides = Partial<Record<TokenKey, Partial<Record<Scheme, string>>>>;

const KEY = 'theme:colorOverrides';
const CUSTOM_KEY = 'theme:custom';
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

/** True for a valid `#rrggbb` string. */
export function isHex(v: string): boolean { return HEX_RE.test(v.trim()); }

/** In-memory mirror so usePalette can read synchronously after the one-time
 *  load, and edits repaint instantly. */
let cache: ColorOverrides = {};
/** Whether the user has opted into the Custom theme. When false, usePalette
 *  ignores every override and renders the plain kit light/dark palette. */
let customEnabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

function persist(): void {
  void AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => { /* best-effort */ });
}

/** Kick off the one-time load from storage; notify subscribers when it lands. */
export function loadOverrides(): void {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.multiGet([KEY, CUSTOM_KEY])
    .then((pairs) => {
      let changed = false;
      for (const [k, raw] of pairs) {
        if (raw == null) continue;
        if (k === KEY) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object') { cache = parsed as ColorOverrides; changed = true; }
        } else if (k === CUSTOM_KEY) {
          customEnabled = raw === '1';
          changed = true;
        }
      }
      if (changed) emit();
    })
    .catch(() => { /* best-effort: keep empty */ });
}

/** Synchronous snapshot of the current overrides. */
export function getOverrides(): ColorOverrides { return cache; }

/** Whether the Custom theme is currently active. */
export function isCustomTheme(): boolean { return customEnabled; }

/** Toggle the Custom theme on/off, then persist + notify so the app repaints. */
export function setCustomTheme(on: boolean): void {
  if (customEnabled === on) return;
  customEnabled = on;
  emit();
  void AsyncStorage.setItem(CUSTOM_KEY, on ? '1' : '0').catch(() => { /* best-effort */ });
}

/** Set (valid hex) or clear (invalid/empty) a single token override for a
 *  scheme, then persist + notify. Invalid hex clears that entry. */
export function setOverride(tokenKey: TokenKey, scheme: Scheme, hex: string): void {
  const valid = isHex(hex);
  const next: ColorOverrides = { ...cache };
  const entry = { ...(next[tokenKey] ?? {}) };
  if (valid) entry[scheme] = hex.trim().toLowerCase();
  else delete entry[scheme];
  if (Object.keys(entry).length === 0) delete next[tokenKey];
  else next[tokenKey] = entry;
  cache = next;
  emit();
  persist();
}

/** Wipe all overrides → back to kit defaults. */
export function resetOverrides(): void {
  cache = {};
  emit();
  persist();
}

/** Subscribe to override changes (load/edit/reset). Returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
