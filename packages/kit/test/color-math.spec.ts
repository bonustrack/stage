import { describe, expect, test } from 'bun:test';
import { LUMA_REC601, LUMA_REC709, formatHex, isHexColor, luminance, parseHex, withAlpha } from '../src/color-math';
import { readableForeground } from '../src/tokens';

describe('parseHex', () => {
  test('reads #rrggbb, trimmed, in any case', () => {
    expect(parseHex(' #0A0b0C ')).toEqual([10, 11, 12]);
  });

  test('rejects short, bare and alpha forms by default', () => {
    expect(parseHex('#abc')).toBeNull();
    expect(parseHex('abcdef')).toBeNull();
    expect(parseHex('#abcdef12')).toBeNull();
  });

  test('short reads #rgb as doubled digits', () => {
    expect(parseHex('#a1f', { short: true })).toEqual([0xaa, 0x11, 0xff]);
    expect(parseHex('a1f', { short: true })).toBeNull();
  });

  test('bare accepts a missing hash only', () => {
    expect(parseHex('ffffff', { bare: true })).toEqual([255, 255, 255]);
    expect(parseHex('##ffffff', { bare: true })).toBeNull();
  });
});

describe('formatHex', () => {
  test('rounds and clamps each channel', () => {
    expect(formatHex([-4, 127.6, 300])).toBe('#0080ff');
    expect(formatHex(parseHex('#12abef') ?? [0, 0, 0])).toBe('#12abef');
  });
});

describe('withAlpha', () => {
  test('writes rgba for #rrggbb and leaves anything else as it is', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('red', 0.5)).toBe('red');
    expect(withAlpha('#f00', 0.5)).toBe('#f00');
  });
});

describe('luminance', () => {
  test('weights the channels with Rec.601 by default and Rec.709 on request', () => {
    expect(luminance([0, 255, 0])).toBeCloseTo(LUMA_REC601[1]);
    expect(luminance([0, 255, 0], LUMA_REC709)).toBeCloseTo(LUMA_REC709[1]);
  });

  test('readableForeground switches to black above 0.6 on the Rec.601 scale', () => {
    expect(readableForeground('#ffffff')).toBe('#000000');
    expect(readableForeground('808080')).toBe('#ffffff');
    expect(readableForeground('not a colour')).toBe('#ffffff');
  });
});

test('isHexColor accepts #rrggbb only', () => {
  expect(isHexColor(' #A0B0C0')).toBe(true);
  expect(isHexColor('#abc')).toBe(false);
});
