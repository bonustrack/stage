import { describe, expect, test } from 'bun:test';
import {
  TEXT_ALIGN_MAP,
  normalizeTextWeight,
  resolveTextSize,
  textFontFamily,
  textRoleColor,
  textVariantRole,
  type TextRole,
  type TextRolePalette,
} from '../src/text.styles';
import { FONT_SIZE } from '../src/tokens';

const PALETTE: TextRolePalette = {
  sub: '#sub000',
  link: '#link00',
  primary: '#prim00',
  danger: '#dang00',
  success: '#succ00',
};

describe('resolveTextSize', () => {
  test('explicit size wins over variant', () => {
    expect(resolveTextSize('2xl', 'caption')).toBe(FONT_SIZE['2xl']);
    expect(resolveTextSize('sm', undefined)).toBe(FONT_SIZE.sm);
  });

  test('caption variant falls back to xs', () => {
    expect(resolveTextSize(undefined, 'caption')).toBe(FONT_SIZE.xs);
  });

  test('default is md', () => {
    expect(resolveTextSize(undefined, undefined)).toBe(FONT_SIZE.md);
    expect(resolveTextSize(undefined, 'body')).toBe(FONT_SIZE.md);
    expect(resolveTextSize(undefined, 'mono')).toBe(FONT_SIZE.md);
  });
});

describe('textVariantRole', () => {
  test('secondary and caption map to the secondary role', () => {
    expect(textVariantRole('secondary')).toBe('secondary');
    expect(textVariantRole('caption')).toBe('secondary');
  });

  test('everything else maps to default', () => {
    expect(textVariantRole('body')).toBe('default');
    expect(textVariantRole('mono')).toBe('default');
    expect(textVariantRole(undefined)).toBe('default');
  });
});

describe('textRoleColor', () => {
  const cases: [TextRole, string][] = [
    ['secondary', PALETTE.sub],
    ['muted', PALETTE.sub],
    ['link', PALETTE.link],
    ['primary', PALETTE.primary],
    ['danger', PALETTE.danger],
    ['success', PALETTE.success],
    ['default', PALETTE.link],
  ];

  for (const [role, expected] of cases) {
    test(`${role} -> ${expected}`, () => {
      expect(textRoleColor(role, PALETTE)).toBe(expected);
    });
  }
});

describe('normalizeTextWeight', () => {
  test('regular normalizes to normal', () => {
    expect(normalizeTextWeight('regular')).toBe('normal');
  });

  test('canonical weights pass through', () => {
    expect(normalizeTextWeight('normal')).toBe('normal');
    expect(normalizeTextWeight('medium')).toBe('medium');
    expect(normalizeTextWeight('semibold')).toBe('semibold');
    expect(normalizeTextWeight('bold')).toBe('bold');
  });
});

describe('textFontFamily', () => {
  test('mono variant always uses Menlo', () => {
    expect(textFontFamily('mono', 'normal')).toBe('Menlo');
    expect(textFontFamily('mono', 'bold')).toBe('Menlo');
  });

  test('non-mono uses Calibre by weight', () => {
    expect(textFontFamily(undefined, 'normal')).toBe('Calibre-Medium');
    expect(textFontFamily('body', 'regular')).toBe('Calibre-Medium');
    expect(textFontFamily('body', 'medium')).toBe('Calibre-Medium');
    expect(textFontFamily('secondary', 'semibold')).toBe('Calibre-Semibold');
    expect(textFontFamily('caption', 'bold')).toBe('Calibre-Semibold');
  });
});

describe('TEXT_ALIGN_MAP', () => {
  test('logical -> physical alignment', () => {
    expect(TEXT_ALIGN_MAP).toEqual({ start: 'left', center: 'center', end: 'right' });
  });
});
