import { describe, expect, test } from 'bun:test';
import { BUTTON_SIZES, SIZES } from '../src/button.styles';
import { CONTROL_SIZES, controlColors, controlTextStyle, type ControlSize } from '../src/control.styles';
import { markdownStyles } from '../src/markdown.styles';
import { resolveTextSize } from '../src/text.styles';
import { FONT_SIZE, fontName, fontSize, type FontSizeName } from '../src/tokens';

describe('text size tokens', () => {
  test('every Text size resolves through fontSize and resolveTextSize alike, whatever the variant', () => {
    for (const name of Object.keys(FONT_SIZE) as FontSizeName[]) {
      expect(fontSize(name)).toBe(FONT_SIZE[name]);
      expect(resolveTextSize(name, 'body')).toBe(FONT_SIZE[name]);
      expect(resolveTextSize(name, 'caption')).toBe(FONT_SIZE[name]);
    }
  });

  test('without a size, body text is md and a caption is 3xs', () => {
    expect(resolveTextSize(undefined, 'body')).toBe(FONT_SIZE.md);
    expect(resolveTextSize(undefined, undefined)).toBe(FONT_SIZE.md);
    expect(resolveTextSize(undefined, 'caption')).toBe(FONT_SIZE['3xs']);
  });

  test('button labels are Text sizes that grow with the button', () => {
    const labels = BUTTON_SIZES.map((size) => SIZES[size].fontSize);
    for (const label of labels) expect(Object.values(FONT_SIZE)).toContain(label);
    expect(labels).toEqual([...labels].sort((a, b) => a - b));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('control typography', () => {
  test('input text matches the Text of the same size in every variant and theme', () => {
    for (const size of Object.keys(CONTROL_SIZES) as ControlSize[]) {
      for (const variant of ['soft', 'outline'] as const) {
        for (const dark of [false, true]) {
          const colors = controlColors(variant, dark);
          expect(controlTextStyle(size, colors)).toEqual({
            color: colors.text,
            fontSize: resolveTextSize(size, undefined),
            fontFamily: fontName.sans,
            padding: 0,
            margin: 0,
          });
        }
      }
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
