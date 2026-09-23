
import { createValueStore } from './persistedStore';
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

function parseSeeds(raw: string): ThemeSeeds | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? migrateSeeds(parsed) : undefined;
  } catch { return undefined; }
}

const seeds = createValueStore<ThemeSeeds>({
  key: 'theme:seed', default: defaultSeeds(), serialize: (v) => JSON.stringify(v), deserialize: parseSeeds,
});

const custom = createValueStore<boolean>({
  key: 'theme:custom', default: false, serialize: (on) => (on ? '1' : '0'), deserialize: (raw) => raw === '1',
});

export const useThemeSeeds = (): ThemeSeeds => seeds.use();

export const useCustomTheme = (): boolean => custom.use();

export function setCustomTheme(on: boolean): void { custom.set(on); }

function patchSeeds(patch: Partial<ThemeSeeds>): void {
  seeds.set({ ...seeds.get(), ...patch });
}

function commit(scheme: Scheme, seed: ThemeSeed): void {
  seeds.set({ ...seeds.get(), [scheme]: seed });
}

export function setSeedColor(scheme: Scheme, key: SeedColorKey, hex: string): void {
  const v = hex.trim().toLowerCase();
  if (!/^#([0-9a-f]{6})$/.test(v)) return;
  const seed = cloneSeed(seeds.get()[scheme]);
  if (key === 'background') seed.surface.background = v;
  else if (key === 'foreground') seed.surface.foreground = v;
  else if (key === 'accent') seed.accent.primary = v;
  else seed.grayscale = grayscaleFromHex(v, scheme);
  commit(scheme, seed);
}

export function setAccentLevel(scheme: Scheme, level: AccentLevel): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.accent.level = level;
  commit(scheme, seed);
}

export function setGrayscaleTint(scheme: Scheme, tint: GrayscaleTint): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.grayscale.tint = tint;
  commit(scheme, seed);
}

export function setGrayscaleShade(scheme: Scheme, shade: GrayscaleShade): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  seed.grayscale.shade = shade;
  commit(scheme, seed);
}

export function setSeedDensity(density: Density): void { patchSeeds({ density }); }

export function setSeedRadius(radius: RadiusName): void { patchSeeds({ radius }); }

export function setSeedBaseSize(baseSize: BaseSize): void { patchSeeds({ baseSize }); }

export function resetOverrides(): void { seeds.set(defaultSeeds()); }
