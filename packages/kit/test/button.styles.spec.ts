import { describe, expect, test } from 'bun:test';
import {
  SIZES,
  resolveColors,
  type ButtonColor,
  type ButtonControlVariant,
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

describe('SIZES', () => {
  test('snapshot', () => {
    expect(SIZES).toMatchSnapshot();
  });
});
