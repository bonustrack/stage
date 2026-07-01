import { describe, expect, test } from 'bun:test';
import {
  SIZES,
  legacyVariantToColor,
  resolveColors,
  resolveModel,
  type ButtonColor,
  type ButtonControlVariant,
  type ButtonVariant,
} from '../src/button.styles';

const COLORS: ButtonColor[] = [
  'primary',
  'secondary',
  'info',
  'discovery',
  'success',
  'caution',
  'warning',
  'danger',
];

const VARIANTS: ButtonControlVariant[] = ['solid', 'soft', 'outline', 'ghost'];

describe('resolveColors', () => {
  test('full matrix snapshot (color x variant x dark)', () => {
    const matrix: Record<string, unknown> = {};
    for (const color of COLORS) {
      for (const variant of VARIANTS) {
        for (const dark of [false, true]) {
          matrix[`${color}/${variant}/${dark ? 'dark' : 'light'}`] = resolveColors(
            color,
            variant,
            dark,
          );
        }
      }
    }
    expect(matrix).toMatchSnapshot();
  });

  test('secondary solid gets a border, other solids do not', () => {
    expect(resolveColors('secondary', 'solid', false).borderColor).toBe('#e4e4e5');
    expect(resolveColors('info', 'solid', false).borderColor).toBeUndefined();
  });
});

describe('legacyVariantToColor', () => {
  test('maps each legacy variant', () => {
    expect(legacyVariantToColor('primary')).toEqual({ color: 'primary', variant: 'solid' });
    expect(legacyVariantToColor('secondary')).toEqual({ color: 'secondary', variant: 'solid' });
    expect(legacyVariantToColor('ghost')).toEqual({ color: 'primary', variant: 'ghost' });
    expect(legacyVariantToColor('danger')).toEqual({ color: 'danger', variant: 'solid' });
  });
});

describe('resolveModel', () => {
  test('legacy variants map via legacyVariantToColor when color is unset', () => {
    const legacy: ButtonVariant[] = ['primary', 'secondary', 'danger'];
    for (const v of legacy) {
      expect(resolveModel(undefined, v, undefined)).toEqual(legacyVariantToColor(v));
    }
    expect(resolveModel(undefined, 'ghost', undefined)).toEqual(
      legacyVariantToColor('ghost'),
    );
  });

  test('legacy variant beats styleColor when color is unset', () => {
    expect(resolveModel(undefined, 'danger', 'secondary')).toEqual({
      color: 'danger',
      variant: 'solid',
    });
  });

  test('legacy variants are ignored when color IS set (falls back to solid)', () => {
    expect(resolveModel('info', 'danger', undefined)).toEqual({
      color: 'info',
      variant: 'solid',
    });
    expect(resolveModel('warning', 'secondary', undefined)).toEqual({
      color: 'warning',
      variant: 'solid',
    });
  });

  test('new-taxonomy variants pass through with explicit color', () => {
    for (const v of VARIANTS) {
      expect(resolveModel('success', v, undefined)).toEqual({ color: 'success', variant: v });
    }
  });

  test('defaults to primary solid when nothing is set', () => {
    expect(resolveModel(undefined, undefined, undefined)).toEqual({
      color: 'primary',
      variant: 'solid',
    });
  });

  test('styleColor is the fallback color when color is unset', () => {
    expect(resolveModel(undefined, undefined, 'secondary')).toEqual({
      color: 'secondary',
      variant: 'solid',
    });
    expect(resolveModel(undefined, 'soft', 'secondary')).toEqual({
      color: 'secondary',
      variant: 'soft',
    });
  });

  test('explicit color wins over styleColor', () => {
    expect(resolveModel('danger', 'outline', 'secondary')).toEqual({
      color: 'danger',
      variant: 'outline',
    });
  });
});

describe('SIZES', () => {
  test('snapshot', () => {
    expect(SIZES).toMatchSnapshot();
  });
});
