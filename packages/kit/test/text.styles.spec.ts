import { describe, expect, test } from 'bun:test';
import { TEXT_ALIGN_MAP, resolveTextSize, textDefaultColor, textFontFamily } from '../src/text.styles';
import { FONT_SIZE } from '../src/tokens';

const PALETTE = { sub: '#sub000', link: '#link00' };

describe('resolveTextSize', () => {
  test('explicit size wins over variant', () => {
    expect(resolveTextSize('2xl', 'caption')).toBe(FONT_SIZE['2xl']);
    expect(resolveTextSize('sm', undefined)).toBe(FONT_SIZE.sm);
  });

  test('caption falls back to 3xs and body to md', () => {
    expect(resolveTextSize(undefined, 'caption')).toBe(FONT_SIZE['3xs']);
    expect(resolveTextSize(undefined, 'body')).toBe(FONT_SIZE.md);
    expect(resolveTextSize(undefined, undefined)).toBe(FONT_SIZE.md);
  });
});

describe('textDefaultColor', () => {
  test('caption is secondary, body is the head colour unless inherited', () => {
    expect(textDefaultColor('caption', PALETTE, '#inherit')).toBe(PALETTE.sub);
    expect(textDefaultColor('body', PALETTE)).toBe(PALETTE.link);
    expect(textDefaultColor(undefined, PALETTE, '#inherit')).toBe('#inherit');
  });
});

describe('textFontFamily', () => {
  test('weights map to the Calibre faces and mono wins', () => {
    expect(textFontFamily(undefined, 'normal')).toBe('Calibre-Medium');
    expect(textFontFamily('sans', 'semibold')).toBe('Calibre-Semibold');
    expect(textFontFamily('mono', 'bold')).toBe('Menlo');
  });
});

describe('TEXT_ALIGN_MAP', () => {
  test('logical alignments resolve to physical ones', () => {
    expect(TEXT_ALIGN_MAP).toEqual({ start: 'left', center: 'center', end: 'right' });
  });
});
