
import { ref, computed, onUnmounted, type Ref } from 'vue';
import {
  THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference,
  type ThemePreference,
} from '@stage-labs/kit/theme';
import {
  DEFAULT_SEED, derivePalette, parseHex,
  type ThemeSeed, type DerivedPalette, type Scheme,
} from '@stage-labs/kit/theme-derive';
import {
  DENSITY_SCALE, RADIUS_SCALE, BASE_SIZE_DEFAULT, DENSITY_DEFAULT, RADIUS_NAME_DEFAULT,
  type Density, type RadiusName, type BaseSize,
} from '@stage-labs/kit/tokens';

export type { ThemePreference };
export type { Density, RadiusName, BaseSize, Scheme, ThemeSeed, DerivedPalette };

function loadInitial(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(v)) return v;
  } catch { }
  return 'system';
}

let cached: ThemePreference = loadInitial();
const listeners = new Set<(p: ThemePreference) => void>();

function emit(p: ThemePreference): void {
  cached = p;
  for (const l of listeners) l(p);
}

export function setThemePreference(p: ThemePreference): void {
  if (!isThemePreference(p)) return;
  emit(p);
  try { localStorage.setItem(STORAGE_KEY, p); } catch { }
}

export function useThemePreference(): Ref<ThemePreference> {
  const r = ref<ThemePreference>(cached);
  const fn = (p: ThemePreference): void => { r.value = p; };
  listeners.add(fn);
  onUnmounted(() => { listeners.delete(fn); });
  return r;
}

const systemDark = ref(typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', e => { systemDark.value = e.matches; });
}

export const systemScheme = computed<'light' | 'dark'>(() => systemDark.value ? 'dark' : 'light');

export function installThemeClassEffect(): void {
  const update = (): void => {
    if (typeof document === 'undefined') return;
    const effective: 'light' | 'dark' = cached === 'system'
      ? (systemDark.value ? 'dark' : 'light')
      : cached;
    document.documentElement.classList.toggle('dark', effective === 'dark');
  };
  listeners.add(update);
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
  }
  update();
}

const CUSTOM_KEY = 'app.theme.custom';
const SEED_KEY = 'app.theme.seed';
const DENSITY_KEY = 'app.theme.density';
const RADIUS_KEY = 'app.theme.radius';
const BASE_SIZE_KEY = 'app.theme.baseSize';

export type SeedColorKey = 'background' | 'foreground' | 'accent' | 'grayscale';

interface DisplayState {
  custom: boolean;
  seeds: Record<Scheme, ThemeSeed>;
  density: Density;
  radius: RadiusName;
  baseSize: BaseSize;
}

function cloneSeeds(s: Record<Scheme, ThemeSeed>): Record<Scheme, ThemeSeed> {
  return {
    light: { ...s.light, surface: { ...s.light.surface } },
    dark: { ...s.dark, surface: { ...s.dark.surface } },
  };
}

function readJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch { return null; }
}

function isSeedRecord(v: unknown): v is Record<Scheme, ThemeSeed> {
  if (typeof v !== 'object' || v == null) return false;
  const r = v as Record<string, unknown>;
  const ok = (s: unknown): boolean => {
    if (typeof s !== 'object' || s == null) return false;
    const x = s as Record<string, unknown>;
    const surf = x.surface as Record<string, unknown> | undefined;
    return typeof x.grayscale === 'string' && typeof x.accent === 'string'
      && surf != null && typeof surf.background === 'string' && typeof surf.foreground === 'string';
  };
  return ok(r.light) && ok(r.dark);
}

function loadDisplay(): DisplayState {
  const seeds = readJson(SEED_KEY, isSeedRecord) ?? cloneSeeds(DEFAULT_SEED);
  const density = readJson(DENSITY_KEY, (v): v is Density => v === 'compact' || v === 'normal' || v === 'spacious') ?? DENSITY_DEFAULT;
  const radius = readJson(RADIUS_KEY, (v): v is RadiusName => v === 'pill' || v === 'round' || v === 'soft' || v === 'sharp') ?? RADIUS_NAME_DEFAULT;
  const baseSize = readJson(BASE_SIZE_KEY, (v): v is BaseSize => v === 14 || v === 15 || v === 16 || v === 17 || v === 18) ?? BASE_SIZE_DEFAULT;
  let custom = false;
  try { custom = localStorage.getItem(CUSTOM_KEY) === '1'; } catch { }
  return { custom, seeds, density, radius, baseSize };
}

const display = ref<DisplayState>(loadDisplay());

function persistDisplay(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, display.value.custom ? '1' : '0');
    localStorage.setItem(SEED_KEY, JSON.stringify(display.value.seeds));
    localStorage.setItem(DENSITY_KEY, JSON.stringify(display.value.density));
    localStorage.setItem(RADIUS_KEY, JSON.stringify(display.value.radius));
    localStorage.setItem(BASE_SIZE_KEY, JSON.stringify(display.value.baseSize));
  } catch { }
}

export function useCustomTheme(): Ref<boolean> {
  return computed(() => display.value.custom);
}

export function setCustomTheme(on: boolean): void {
  display.value = { ...display.value, custom: on };
  persistDisplay();
}

export function useThemeSeeds(): Ref<Record<Scheme, ThemeSeed>> {
  return computed(() => display.value.seeds);
}

export function useDensity(): Ref<Density> { return computed(() => display.value.density); }
export function useRadius(): Ref<RadiusName> { return computed(() => display.value.radius); }
export function useBaseSize(): Ref<BaseSize> { return computed(() => display.value.baseSize); }

export function setSeedColor(scheme: Scheme, key: SeedColorKey, value: string): void {
  if (parseHex(value) == null) return;
  const seeds = cloneSeeds(display.value.seeds);
  if (key === 'background') seeds[scheme].surface.background = value;
  else if (key === 'foreground') seeds[scheme].surface.foreground = value;
  else seeds[scheme][key] = value;
  display.value = { ...display.value, seeds, custom: true };
  persistDisplay();
}

export function setDensity(d: Density): void {
  display.value = { ...display.value, density: d, custom: true };
  persistDisplay();
}

export function setRadius(r: RadiusName): void {
  display.value = { ...display.value, radius: r, custom: true };
  persistDisplay();
}

export function setBaseSize(b: BaseSize): void {
  display.value = { ...display.value, baseSize: b, custom: true };
  persistDisplay();
}

export function resetDisplayOverrides(): void {
  display.value = {
    custom: false,
    seeds: cloneSeeds(DEFAULT_SEED),
    density: DENSITY_DEFAULT,
    radius: RADIUS_NAME_DEFAULT,
    baseSize: BASE_SIZE_DEFAULT,
  };
  persistDisplay();
}

export function customPalette(scheme: Scheme): DerivedPalette {
  return derivePalette(display.value.seeds[scheme], scheme);
}

export function seedColorValue(scheme: Scheme, key: SeedColorKey): string {
  const seed = display.value.seeds[scheme];
  return key === 'background' ? seed.surface.background
    : key === 'foreground' ? seed.surface.foreground
      : seed[key];
}

export const customDisplay = computed(() => display.value);

export const radiusPx = computed<number>(() => RADIUS_SCALE[display.value.radius]);
export const densityScale = computed(() => DENSITY_SCALE[display.value.density]);
