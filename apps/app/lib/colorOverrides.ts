/** ChatKit SEED-based theme store (per-scheme) + the Custom-theme flag.
 *
 *  Replaces the old 9-flat-hex per-token override model with ChatKit's SEED
 *  model: the user sets a few SEEDS (grayscale base, accent, surface
 *  background/foreground) plus density/radius/typography, and the full palette
 *  is DERIVED by @metro-labs/kit `derivePalette`. usePalette() layers the
 *  derived palette OVER the kit default; the default seed reproduces today's
 *  palette pixel-for-pixel (lossless).
 *
 *  Device-only, persisted to AsyncStorage. Same in-memory-mirror + pub/sub
 *  pattern as before; no new dependency.
 *
 *  UPGRADE: a user with no saved seed (`theme:seed`) starts on the default seed
 *  (which is lossless: reproduces today's palette pixel-for-pixel). The old
 *  per-token hex override key (`theme:colorOverrides`) is NOT read or migrated -
 *  everyone gets a clean default seed and can re-customize from the editor. The
 *  old key is left in storage untouched (non-destructive); we just ignore it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SEED, type ThemeSeed, type Scheme,
  type RadiusName, type Density, type BaseSize,
  RADIUS_NAME_DEFAULT, DENSITY_DEFAULT, BASE_SIZE_DEFAULT,
} from '@metro-labs/kit';

export type { Scheme };

/** The persisted Custom theme: a seed per scheme + shared non-color knobs. */
export interface ThemeSeeds {
  light: ThemeSeed;
  dark: ThemeSeed;
  density: Density;
  radius: RadiusName;
  baseSize: BaseSize;
}

const SEED_KEY = 'theme:seed';
const CUSTOM_KEY = 'theme:custom';
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

/** True for a valid `#rrggbb` string. */
export function isHex(v: string): boolean { return HEX_RE.test(v.trim()); }

/** The clean default seeds (lossless: reproduces today's palette exactly). */
export function defaultSeeds(): ThemeSeeds {
  return {
    light: { ...DEFAULT_SEED.light, surface: { ...DEFAULT_SEED.light.surface } },
    dark: { ...DEFAULT_SEED.dark, surface: { ...DEFAULT_SEED.dark.surface } },
    density: DENSITY_DEFAULT,
    radius: RADIUS_NAME_DEFAULT,
    baseSize: BASE_SIZE_DEFAULT,
  };
}

let cache: ThemeSeeds = defaultSeeds();
let customEnabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

function persist(): void {
  void AsyncStorage.setItem(SEED_KEY, JSON.stringify(cache)).catch(() => { /* best-effort */ });
}

/** Kick off the one-time load from storage; notify subscribers when it lands.
 *  No saved seed -> keep the default seed (lossless). The old per-token override
 *  key is intentionally not read: everyone upgrades onto a clean default seed. */
export function loadOverrides(): void {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.multiGet([SEED_KEY, CUSTOM_KEY])
    .then((pairs) => {
      let changed = false;
      const map = new Map(pairs);
      const seedRaw = map.get(SEED_KEY);
      if (seedRaw != null) {
        const parsed = JSON.parse(seedRaw) as Partial<ThemeSeeds>;
        if (parsed && typeof parsed === 'object' && parsed.light && parsed.dark) {
          cache = { ...defaultSeeds(), ...parsed } as ThemeSeeds;
          changed = true;
        }
      }
      const customRaw = map.get(CUSTOM_KEY);
      if (customRaw != null) { customEnabled = customRaw === '1'; changed = true; }
      if (changed) emit();
    })
    .catch(() => { /* best-effort: keep default seed */ });
}

/** Synchronous snapshot of the current seeds. */
export function getSeeds(): ThemeSeeds { return cache; }

/** Whether the Custom theme is currently active. */
export function isCustomTheme(): boolean { return customEnabled; }

/** Toggle the Custom theme on/off, then persist + notify so the app repaints. */
export function setCustomTheme(on: boolean): void {
  if (customEnabled === on) return;
  customEnabled = on;
  emit();
  void AsyncStorage.setItem(CUSTOM_KEY, on ? '1' : '0').catch(() => { /* best-effort */ });
}

/** Set one seed COLOR (grayscale|accent|background|foreground) for a scheme.
 *  Invalid hex is ignored. Persists + notifies so the app re-themes live. */
export type SeedColorKey = 'grayscale' | 'accent' | 'background' | 'foreground';
export function setSeedColor(scheme: Scheme, key: SeedColorKey, hex: string): void {
  if (!isHex(hex)) return;
  const v = hex.trim().toLowerCase();
  const next: ThemeSeeds = { ...cache, [scheme]: { ...cache[scheme], surface: { ...cache[scheme].surface } } };
  const s = next[scheme];
  if (key === 'background') s.surface.background = v;
  else if (key === 'foreground') s.surface.foreground = v;
  else s[key] = v;
  cache = next;
  emit();
  persist();
}

/** Set the shared density seed. */
export function setSeedDensity(d: Density): void {
  cache = { ...cache, density: d };
  emit();
  persist();
}

/** Set the shared radius (name) seed. */
export function setSeedRadius(r: RadiusName): void {
  cache = { ...cache, radius: r };
  emit();
  persist();
}

/** Set the shared base font size seed. */
export function setSeedBaseSize(b: BaseSize): void {
  cache = { ...cache, baseSize: b };
  emit();
  persist();
}

/** Reset to the default seed -> back to today's exact palette. */
export function resetOverrides(): void {
  cache = defaultSeeds();
  emit();
  persist();
}

/** Subscribe to seed/custom changes (load/edit/reset). Returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
