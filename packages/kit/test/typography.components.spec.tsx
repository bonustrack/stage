import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { FONT_SIZE, fontName, kitPalette, resolveColorToken } from '../src/tokens';
import { HERO_TITLE_STYLE } from '../src/title.styles';
import { TEXT_FONTS } from '../src/text.styles';
import { KitThemeProvider } from '../src/react-native/theme-context';

mock.module('react-native', () => ReactNativeWeb);
mock.module('../src/react-native/spinner', () => ({ Spinner: () => null }));

const { Button } = await import('../src/react-native/button');
const { Text } = await import('../src/react-native/text');
const { TextField } = await import('../src/react-native/text-field');
const { Title } = await import('../src/react-native/title');

const BUTTON_TEXT = { xs: '2xs', sm: 'xs', md: 'sm', lg: 'md', xl: 'lg' } as const;
const FIELD_HEIGHTS = { xs: 60, sm: 60, md: 66, lg: 66, xl: 72 } as const;

for (const kind of ['shortText', 'longText'] as const) {
  describe(`TextField ${kind} typography`, () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      test(`${size} matches Text in both variants and themes`, () => {
        for (const appearance of ['soft', 'outline'] as const) {
          for (const dark of [false, true]) {
            const html = renderToStaticMarkup(
              <>
                <TextField size={size} variant={kind} appearance={appearance} dark={dark} value="Example" />
                <Text size={size} text="Example" />
              </>,
            );
            expect(html.match(new RegExp(`font-size:${FONT_SIZE[size]}px`, 'g'))).toHaveLength(2);
            expect(html.match(new RegExp(`font-family:${fontName.sans}`, 'g'))).toHaveLength(2);
            if (kind === 'longText') expect(html).toContain(`height:${FIELD_HEIGHTS[size]}px`);
          }
        }
      });
    }

    test('defaults match Text md and keep existing heights and explicit style overrides', () => {
      const html = renderToStaticMarkup(
        <>
          <TextField variant={kind} value="Example" />
          <Text text="Example" />
        </>,
      );
      expect(html.match(new RegExp(`font-size:${FONT_SIZE.md}px`, 'g'))).toHaveLength(2);
      expect(html).toContain('min-height:40px');
      if (kind === 'longText') expect(html).toContain('height:66px');
      const override = renderToStaticMarkup(<TextField variant={kind} style={{ fontSize: FONT_SIZE.xs }} value="Example" />);
      expect(override).toContain(`font-size:${FONT_SIZE.xs}px`);
      expect(override).not.toContain(`font-size:${FONT_SIZE.md}px`);
    });
  });
}

function normalizeInlineStyleOrder(html: string): string {
  return html.replace(/style="([^"]*)"/g, (_match, declarations: string) => `style="${declarations.split(';').sort().join(';')}"`);
}

describe('Title style parity', () => {
  for (const hero of [undefined, '3xl', '4xl'] as const) {
    test(`${hero ?? 'default'} preserves levels, sizes, colors, themes and style overrides`, () => {
      const levelSizes = { 1: 30, 2: 24, 3: 21 };
      const sizeLevels = { sm: 3, md: 2, lg: 1 } as const;
      for (const scheme of ['light', 'dark'] as const) {
        const palette = kitPalette(scheme);
        for (const level of [undefined, 1, 2, 3] as const) {
          for (const size of [undefined, 'sm', 'md', 'lg'] as const) {
            for (const color of [undefined, 'secondary', '#123456'] as const) {
              for (const style of [undefined, { fontSize: 13, color: '#abcdef' }, [{ fontSize: 14 }, { lineHeight: 20 }]]) {
                const base = Object.assign(
                  {
                    color: color != null ? resolveColorToken(color, scheme) : palette.link,
                    fontSize: levelSizes[level ?? (size ? sizeLevels[size] : 2)],
                    fontFamily: fontName.head,
                  },
                  hero === undefined ? {} : HERO_TITLE_STYLE[hero],
                );
                const actual = renderToStaticMarkup(
                  <KitThemeProvider value={palette} scheme={scheme}>
                    <Title level={level} size={size} hero={hero} color={color} style={style} numberOfLines={2}>
                      Example
                    </Title>
                  </KitThemeProvider>,
                );
                const expected = renderToStaticMarkup(
                  <ReactNativeWeb.Text style={style ? [base, style] : base} numberOfLines={2}>
                    Example
                  </ReactNativeWeb.Text>,
                );
                expect(normalizeInlineStyleOrder(actual)).toBe(normalizeInlineStyleOrder(expected));
              }
            }
          }
        }
      }
    });
  }
});

describe('Button labels', () => {
  for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
    for (const variant of ['solid', 'soft', 'outline', 'ghost'] as const) {
      test(`${size} ${variant} uses its text token and Medium for labels and string children`, () => {
        for (const dark of [false, true]) {
          for (const content of [{ label: 'Example' }, { children: 'Example' }]) {
            const html = renderToStaticMarkup(<Button size={size} variant={variant} dark={dark} {...content} />);
            expect(html).toContain(`font-size:${FONT_SIZE[BUTTON_TEXT[size]]}px`);
            expect(html).toContain(`font-family:${fontName.sans}`);
            expect(html).not.toContain(fontName.head);
          }
        }
      });
    }
  }
});

describe('Caption typography', () => {
  test('each size matches Text while preserving every weight and theme', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const size of ['sm', 'md'] as const) {
        for (const weight of ['normal', 'medium', 'semibold'] as const) {
          const html = renderToStaticMarkup(
            <KitThemeProvider value={kitPalette(scheme)} scheme={scheme}>
              <Text variant="caption" size={size} fontWeight={weight} text="Example" />
              <Text size={size} fontWeight={weight} text="Example" />
            </KitThemeProvider>,
          );
          expect(html.match(new RegExp(`font-size:${FONT_SIZE[size]}px`, 'g'))).toHaveLength(2);
          expect(html.match(new RegExp(`font-family:${TEXT_FONTS[weight]}`, 'g'))).toHaveLength(2);
        }
      }
    }
  });

  test('the caption variant is 3xs and Medium, with explicit text styles still supported', () => {
    const html = renderToStaticMarkup(<Text variant="caption" text="Example" />);
    expect(html).toContain(`font-size:${FONT_SIZE['3xs']}px`);
    expect(html).toContain(`font-family:${TEXT_FONTS.medium}`);
    const override = renderToStaticMarkup(<Text variant="caption" style={{ fontSize: FONT_SIZE.xs }} text="Example" />);
    expect(override).toContain(`font-size:${FONT_SIZE.xs}px`);
  });
});
