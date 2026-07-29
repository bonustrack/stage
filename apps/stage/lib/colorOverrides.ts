
import { appStorage } from '../platform/storage';
import {
  grayscaleFromHex,
  type ThemeSeed, type Scheme, type AccentLevel,
  type GrayscaleShade, type GrayscaleTint,
  type RadiusName, type Density, type BaseSize,
} from '@stage-labs/kit';
import {
  cloneSeed, defaultSeeds, migrateSeeds,
  type SeedColorKey, type ThemeSeeds,
} from './colorOverrides.model';

export type { Scheme, ThemeSeeds, SeedColorKey };
export { isHex, seedColorHex } from './colorOverrides.model';

const SEED_KEY = 'theme:seed';
const CUSTOM_KEY = 'theme:custom';

let cache: ThemeSeeds = defaultSeeds();
let customEnabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

function persist(): void {
  void appStorage.set(SEED_KEY, JSON.stringify(cache)).catch(() => undefined);
}

export function loadOverrides(): void {
  if (loaded) return;
  loaded = true;
  void appStorage.multiGet([SEED_KEY, CUSTOM_KEY])
    .then((pairs) => {
      let changed = false;
      const map = new Map(pairs);
      const seedRaw = map.get(SEED_KEY);
      if (seedRaw != null) {
        const parsed: unknown = JSON.parse(seedRaw);
        if (parsed && typeof parsed === 'object') { cache = migrateSeeds(parsed); changed = true; }
      }
      const customRaw = map.get(CUSTOM_KEY);
      if (customRaw != null) { customEnabled = customRaw === '1'; changed = true; }
      if (changed) emit();
    })
    .catch(() => undefined);
}

export function getSeeds(): ThemeSeeds { return cache; }

export function isCustomTheme(): boolean { return customEnabled; }

export function setCustomTheme(on: boolean): void {
  if (customEnabled === on) return;
  customEnabled = on;
  emit();
  void appStorage.set(CUSTOM_KEY, on ? '1' : '0').catch(() => undefined);
}

function commit(scheme: Scheme, seed: ThemeSeed): void {
  cache = { ...cache, [scheme]: seed };
  emit();
  persist();
}

export function setSeedColor(scheme: Scheme, key: SeedColorKey, hex: string): void {
  const v = hex.trim().toLowerCase();
  if (!/^#([0-9a-f]{6})$/.test(v)) return;
  const seed = cloneSeed(cache[scheme]);
  if (key === 'background') seed.surface.background = v;
  else if (key === 'foreground') seed.surface.foreground = v;
  else if (key === 'accent') seed.accent.primary = v;
  else seed.grayscale = grayscaleFromHex(v, scheme);
  commit(scheme, seed);
}

export function setAccentLevel(scheme: Scheme, level: AccentLevel): void {
  const seed = cloneSeed(cache[scheme]);
  seed.accent.level = level;
  commit(scheme, seed);
}

export function setGrayscaleTint(scheme: Scheme, tint: GrayscaleTint): void {
  const seed = cloneSeed(cache[scheme]);
  seed.grayscale.tint = tint;
  commit(scheme, seed);
}

export function setGrayscaleShade(scheme: Scheme, shade: GrayscaleShade): void {
  const seed = cloneSeed(cache[scheme]);
  seed.grayscale.shade = shade;
  commit(scheme, seed);
}

export function setSeedDensity(d: Density): void {
  cache = { ...cache, density: d };
  emit();
  persist();
}

export function setSeedRadius(r: RadiusName): void {
  cache = { ...cache, radius: r };
  emit();
  persist();
}

export function setSeedBaseSize(b: BaseSize): void {
  cache = { ...cache, baseSize: b };
  emit();
  persist();
}

export function resetOverrides(): void {
  cache = defaultSeeds();
  emit();
  persist();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
