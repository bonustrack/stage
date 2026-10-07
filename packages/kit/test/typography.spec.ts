import { describe, expect, test } from 'bun:test';
import { CONTROL_SIZES, controlColors, controlTextStyle } from '../src/control.styles';
import { markdownStyles } from '../src/markdown.styles';
import { resolveTextSize } from '../src/text.styles';
import { FONT_SIZE } from '../src/tokens';

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
