import { describe, expect, test } from 'bun:test';
import { migrateSeeds } from '../lib/colorOverrides.model';
import { DEFAULT_SEED } from '@stage-labs/kit/theme-derive';

const LEGACY_PERSISTED = {
  light: {
    grayscale: '#e4e4e5',
    accent: '#000000',
    surface: { background: '#ffffff', foreground: '#57606a' },
  },
  dark: {
    grayscale: '#282a2d',
    accent: '#ffffff',
    surface: { background: '#0e0f10', foreground: '#9f9fa3' },
  },
  density: 'compact',
  radius: 'soft',
  baseSize: 17,
};

describe('migrateSeeds', () => {
  test('converts legacy flat-hex seeds into the ChatKit shape without changing the colours', () => {
    const next = migrateSeeds(LEGACY_PERSISTED);
    expect(next.dark).toEqual(DEFAULT_SEED.dark);
    expect(next.light).toEqual(DEFAULT_SEED.light);
  });

  test('preserves non-colour prefs across the migration', () => {
    const next = migrateSeeds(LEGACY_PERSISTED);
    expect(next.density).toBe('compact');
    expect(next.radius).toBe('soft');
    expect(next.baseSize).toBe(17);
  });

  test('a custom legacy accent keeps its hex and takes the default level', () => {
    const next = migrateSeeds({ ...LEGACY_PERSISTED, dark: { ...LEGACY_PERSISTED.dark, accent: '#ff6600' } });
    expect(next.dark.accent).toEqual({ primary: '#ff6600', level: DEFAULT_SEED.dark.accent.level });
  });

  test('already-migrated seeds round-trip unchanged', () => {
    const migrated = migrateSeeds(LEGACY_PERSISTED);
    expect(migrateSeeds(migrated)).toEqual(migrated);
  });

  test('garbage and missing fields fall back to defaults', () => {
    expect(migrateSeeds(null).dark).toEqual(DEFAULT_SEED.dark);
    expect(migrateSeeds({}).light).toEqual(DEFAULT_SEED.light);
    expect(migrateSeeds({ dark: { accent: 42, grayscale: [], surface: 'nope' } }).dark)
      .toEqual(DEFAULT_SEED.dark);
  });
});
