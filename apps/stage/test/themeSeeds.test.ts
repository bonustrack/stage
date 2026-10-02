import { describe, expect, test } from 'bun:test';
import { migrateSeeds } from '../lib/colorOverrides.model';
import { DEFAULT_SEED } from '@stage-labs/kit/theme-derive';

const PERSISTED = {
  light: DEFAULT_SEED.light,
  dark: { ...DEFAULT_SEED.dark, accent: { primary: '#ff6600', level: 2 } },
  density: 'compact',
  radius: 'soft',
  baseSize: 17,
};

describe('migrateSeeds', () => {
  test('keeps saved colours and non-colour prefs', () => {
    const next = migrateSeeds(PERSISTED);
    expect(next.light).toEqual(DEFAULT_SEED.light);
    expect(next.dark.accent).toEqual({ primary: '#ff6600', level: 2 });
    expect(next.density).toBe('compact');
    expect(next.radius).toBe('soft');
    expect(next.baseSize).toBe(17);
  });

  test('saved seeds round-trip unchanged', () => {
    const next = migrateSeeds(PERSISTED);
    expect(migrateSeeds(next)).toEqual(next);
  });

  test('garbage and missing fields fall back to defaults', () => {
    expect(migrateSeeds(null).dark).toEqual(DEFAULT_SEED.dark);
    expect(migrateSeeds({}).light).toEqual(DEFAULT_SEED.light);
    expect(migrateSeeds({ dark: { accent: 42, grayscale: [], surface: 'nope' } }).dark)
      .toEqual(DEFAULT_SEED.dark);
  });
});
