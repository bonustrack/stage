import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { z } from 'zod';
import { secureStorage } from '../platform/storage';
import { THEME_STORAGE_KEY as STORAGE_KEY, isThemePreference, type ThemePreference } from '@stage-labs/kit/theme';
import {
  semanticColors,
  kitPalette,
  type KitPalette,
  type Scheme,
  type RadiusName,
  type Density,
  type BaseSize,
} from '@stage-labs/kit/tokens';
import { derivePalette, type ThemeSeed, type AccentLevel, type GrayscaleShade, type GrayscaleTint } from '@stage-labs/kit/theme-derive';
import type { KitThemeValue } from '@stage-labs/kit/react-native/theme-context';
import { createValueStore, flagCodec } from './persistedStore';
import { cloneSeed, defaultSeeds, migrateSeeds, withSeedColor, type SeedColorKey, type ThemeSeeds } from './colorOverrides.model';

export type { ThemePreference, SeedColorKey };
export { isHex, seedColorHex } from './colorOverrides.model';

export const DANGER = semanticColors.dangerColor.dark;
export const SUCCESS = semanticColors.successColor.dark;

const preference = createValueStore<ThemePreference>({
  key: STORAGE_KEY,
  default: 'system',
  storage: secureStorage,
  deserialize: (raw) => (isThemePreference(raw) ? raw : undefined),
});

export async function setThemePreference(p: ThemePreference): Promise<void> {
  if (!isThemePreference(p)) return;
  await preference.setAsync(p);
}

export const useThemePreference = (): ThemePreference => preference.use();

export type Palette = KitPalette;

export function useThemeFromSettings(): KitThemeValue {
  const pref = useThemePreference();
  const sys = useColorScheme();
  const scheme = pref !== 'system' ? pref : sys === 'dark' ? 'dark' : 'light';
  const isCustom = useCustomTheme();
  const themeSeeds = useThemeSeeds();
  const palette = useMemo(
    () => (isCustom ? { ...derivePalette(themeSeeds[scheme], scheme) } : kitPalette(scheme)),
    [scheme, isCustom, themeSeeds],
  );
  return { palette, scheme };
}

export { useKitPalette as usePalette, useKitScheme as useEffectiveColorScheme } from '@stage-labs/kit/react-native/theme-context';

const storedSeedsSchema = z.custom<object>((value) => value !== null && typeof value === 'object').transform(migrateSeeds);

const seeds = createValueStore<ThemeSeeds>({ key: 'theme:seed', default: defaultSeeds(), schema: storedSeedsSchema });

const custom = createValueStore<boolean>({ key: 'theme:custom', default: false, ...flagCodec(false) });

export const useThemeSeeds = (): ThemeSeeds => seeds.use();

export const useCustomTheme = (): boolean => custom.use();

export type ThemeChoice = ThemePreference | 'custom';

export function useThemeChoice(): ThemeChoice {
  const pref = useThemePreference();
  return useCustomTheme() ? 'custom' : pref;
}

export function chooseTheme(choice: ThemeChoice): void {
  custom.set(choice === 'custom');
  if (choice !== 'custom') void setThemePreference(choice);
}

function patchSeeds(patch: Partial<ThemeSeeds>): void {
  seeds.set({ ...seeds.get(), ...patch });
}

function editSeed(scheme: Scheme, edit: (seed: ThemeSeed) => void): void {
  const seed = cloneSeed(seeds.get()[scheme]);
  edit(seed);
  seeds.set({ ...seeds.get(), [scheme]: seed });
}

export function setSeedColor(scheme: Scheme, key: SeedColorKey, hex: string): void {
  const next = withSeedColor(seeds.get(), scheme, key, hex);
  if (next !== null) seeds.set(next);
}

export function setAccentLevel(scheme: Scheme, level: AccentLevel): void {
  editSeed(scheme, (seed) => {
    seed.accent.level = level;
  });
}

export function setGrayscaleTint(scheme: Scheme, tint: GrayscaleTint): void {
  editSeed(scheme, (seed) => {
    seed.grayscale.tint = tint;
  });
}

export function setGrayscaleShade(scheme: Scheme, shade: GrayscaleShade): void {
  editSeed(scheme, (seed) => {
    seed.grayscale.shade = shade;
  });
}

export function setSeedDensity(density: Density): void {
  patchSeeds({ density });
}

export function setSeedRadius(radius: RadiusName): void {
  patchSeeds({ radius });
}

export function setSeedBaseSize(baseSize: BaseSize): void {
  patchSeeds({ baseSize });
}

export function resetOverrides(): void {
  seeds.set(defaultSeeds());
}
