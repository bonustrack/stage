import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { FONT_SIZE, fontName, kitPalette } from '../src/tokens';
import { TEXT_FONTS } from '../src/text.styles';
import { KitThemeProvider } from '../src/react-native/theme-context';

mock.module('react-native', () => ReactNativeWeb);
mock.module('../src/react-native/spinner', () => ({ Spinner: () => null }));

const { Button } = await import('../src/react-native/button');
const { Caption } = await import('../src/react-native/caption');
const { Text } = await import('../src/react-native/text');

const BUTTON_TEXT = { xs: '2xs', sm: 'xs', md: 'sm', lg: 'md', xl: 'lg' } as const;

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
              <Caption size={size} weight={weight} value="Example" />
              <Text size={size} weight={weight} value="Example" />
            </KitThemeProvider>,
          );
          expect(html.match(new RegExp(`font-size:${FONT_SIZE[size]}px`, 'g'))).toHaveLength(2);
          expect(html.match(new RegExp(`font-family:${TEXT_FONTS[weight]}`, 'g'))).toHaveLength(2);
        }
      }
    }
  });

  test('defaults stay md and Medium, with explicit text styles still supported', () => {
    const html = renderToStaticMarkup(<Caption value="Example" />);
    expect(html).toContain(`font-size:${FONT_SIZE.md}px`);
    expect(html).toContain(`font-family:${TEXT_FONTS.medium}`);
    const override = renderToStaticMarkup(<Caption style={{ fontSize: FONT_SIZE.xs }} value="Example" />);
    expect(override).toContain(`font-size:${FONT_SIZE.xs}px`);
  });
});
