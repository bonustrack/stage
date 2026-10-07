import { describe, expect, test } from 'bun:test';
import { resolveBadgeStyle, type BadgeSize } from '../src/badge';
import { SIZES } from '../src/button.styles';
import { CONTROL_SIZES, controlColors, controlTextStyle } from '../src/control.styles';
import { markdownStyles } from '../src/markdown.styles';
import { resolveTextSize, SMALL_FONT_SIZE } from '../src/text.styles';
import { FONT_SIZE, FONT_SIZE_SNAP, fontSize, type FontSizeName } from '../src/tokens';

const TEXT_SIZES: Record<FontSizeName, number> = {
  '3xs': 13, '2xs': 14, xs: 16, sm: 17, md: 18, lg: 19, xl: 20, '2xl': 24, '3xl': 32,
};

describe('text size tokens', () => {
  test('all options keep their numeric sizes after the small-token rename', () => {
    expect(FONT_SIZE).toEqual(TEXT_SIZES);
    for (const name of Object.keys(TEXT_SIZES) as FontSizeName[]) {
      expect(fontSize(name)).toBe(TEXT_SIZES[name]);
      expect(resolveTextSize(name, 'body')).toBe(TEXT_SIZES[name]);
      expect(resolveTextSize(name, 'caption')).toBe(TEXT_SIZES[name]);
    }
    expect(Object.hasOwn(FONT_SIZE, '4xs')).toBe(false);
    expect(Object.hasOwn(FONT_SIZE, '4xl')).toBe(false);
    expect(Object.values(FONT_SIZE)).not.toContain(15);
  });

  test('snapping uses current names and promotes removed 15px text to xs', () => {
    expect(FONT_SIZE_SNAP).toEqual({
      '10': '3xs', '11': '3xs', '12': '3xs', '13': '3xs', '14': '2xs',
      '15': 'xs', '16': 'xs', '17': 'sm', '18': 'md', '19': 'lg', '20': 'xl',
      '22': '2xl', '24': '2xl', '26': '2xl', '28': '3xl', '34': '3xl', '38': '3xl',
    });
    for (const token of Object.values(FONT_SIZE_SNAP)) expect(FONT_SIZE[token]).toBeDefined();
  });

  test('button and badge size names and dimensions are unchanged', () => {
    expect(Object.values(SIZES).map((size) => size.fontSize)).toEqual([13, 14, 17, 18, 19]);
    const badgeFonts = { ...SMALL_FONT_SIZE, ...FONT_SIZE };
    const sizes: BadgeSize[] = ['3xs', '2xs', 'sm', 'md', 'lg'];
    expect(sizes.map((size) => badgeFonts[resolveBadgeStyle(undefined, undefined, size, 'light').fontToken]))
      .toEqual([11, 12, 13, 13, 13]);
  });
});

describe('xs typography', () => {
  test('xs text is 16px and body and caption sizes are unchanged', () => {
    expect(resolveTextSize('xs', undefined)).toBe(16);
    expect(resolveTextSize(undefined, 'body')).toBe(18);
    expect(resolveTextSize(undefined, 'caption')).toBe(13);
  });

  test('medium controls use xs text without resizing the control', () => {
    expect(CONTROL_SIZES.md).toEqual({
      minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: FONT_SIZE.xs,
    });
    expect(Object.values(CONTROL_SIZES).map((size) => size.fontSize)).toEqual([14, 14, 16, 16, 17]);
    for (const dark of [false, true]) {
      expect(controlTextStyle('md', controlColors('soft', dark)).fontSize).toBe(16);
    }
  });

  test('Markdown defaults use xs, preserving larger headings and code sizes', () => {
    const styles = markdownStyles({ fg: '#fff', dark: true });
    for (const key of ['body', 'strong', 'em', 'bullet_list_icon', 'ordered_list_icon']) {
      expect(styles[key]).toMatchObject({ fontSize: 16, lineHeight: 23 });
    }
    for (const [index, fontSize] of [24, 20, 17, 16, 16, 16].entries()) {
      expect(styles[`heading${index + 1}`]).toMatchObject({ fontSize });
    }
    expect(styles.code_inline).toMatchObject({ fontSize: 14 });
    expect(styles.code_block).toMatchObject({ fontSize: 13 });
  });

  test('explicit Markdown body size and scaled headings are unchanged', () => {
    const styles = markdownStyles({ fg: '#000', dark: false, fontSize: 18, lineHeight: 27 });
    expect(styles.body).toMatchObject({ fontSize: 18, lineHeight: 27 });
    for (const [index, fontSize] of [29, 24, 21, 18, 18, 18].entries()) {
      expect(styles[`heading${index + 1}`]).toMatchObject({ fontSize });
    }
  });
});
