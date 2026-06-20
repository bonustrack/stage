
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SEED, type ThemeSeed, type Scheme,
  type RadiusName, type Density, type BaseSize,
  RADIUS_NAME_DEFAULT, DENSITY_DEFAULT, BASE_SIZE_DEFAULT,
} from '@stage-labs/kit';

export type { Scheme };

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

export function isHex(v: string): boolean { return HEX_RE.test(v.trim()); }

function defaultSeeds(): ThemeSeeds {
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
  void AsyncStorage.setItem(SEED_KEY, JSON.stringify(cache)).catch(() => undefined);
}

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
          cache = { ...defaultSeeds(), ...parsed };
          changed = true;
        }
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
  void AsyncStorage.setItem(CUSTOM_KEY, on ? '1' : '0').catch(() => undefined);
}

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
