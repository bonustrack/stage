import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { FONT_SIZE, fontName, kitPalette, resolveColorToken } from '../src/tokens';
import { derivePalette } from '../src/theme-derive';
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

function cssColor(hex: string): string {
  const html = renderToStaticMarkup(<ReactNativeWeb.Text style={{ color: hex }}>Example</ReactNativeWeb.Text>);
  const match = /color:([^;"]+)/.exec(html);
  if (!match?.[1]) throw new Error(`no rendered colour for ${hex}`);
  return match[1];
}

describe('Title', () => {
  test('levels pick the heading size in the head font, a level wins over a size and the default is level 2', () => {
    const html = (title: React.ReactElement): string => renderToStaticMarkup(title);
    expect(html(<Title>Example</Title>)).toContain('font-size:24px');
    expect(html(<Title>Example</Title>)).toContain(`font-family:${fontName.head}`);
    expect(html(<Title level={1}>Example</Title>)).toContain('font-size:30px');
    expect(html(<Title level={3}>Example</Title>)).toContain('font-size:21px');
    expect(html(<Title size="lg">Example</Title>)).toContain('font-size:30px');
    expect(html(<Title size="sm">Example</Title>)).toContain('font-size:21px');
    expect(
      html(
        <Title level={1} size="sm">
          Example
        </Title>,
      ),
    ).toContain('font-size:30px');
  });

  test('hero titles take the landing sizes in the regular font, whatever the level', () => {
    const big = renderToStaticMarkup(
      <Title hero="4xl" level={3}>
        Example
      </Title>,
    );
    expect(big).toContain('font-size:76px');
    expect(big).toContain('line-height:83.6px');
    expect(big).toContain(`font-family:${fontName.sans}`);
    expect(big).not.toContain(fontName.head);
    const onboarding = renderToStaticMarkup(<Title hero="3xl">Example</Title>);
    expect(onboarding).toContain('font-size:38px');
    expect(onboarding).toContain('line-height:46px');
  });

  test('the default colour follows the provided palette, even a derived one', () => {
    const derived = derivePalette(
      {
        accent: { primary: '#ff6600', level: 3 },
        grayscale: { hue: 210, tint: 4, shade: 1 },
        surface: { background: '#101820', foreground: '#c0c8d0' },
      },
      'dark',
    );
    expect(derived.link).not.toBe(kitPalette('dark').link);
    const html = renderToStaticMarkup(
      <KitThemeProvider value={derived} scheme="dark">
        <Title>Example</Title>
      </KitThemeProvider>,
    );
    expect(html).toContain(cssColor(derived.link));
  });

  test('a colour token resolves for the scheme and a hex colour is used as given', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const html = renderToStaticMarkup(
        <KitThemeProvider value={kitPalette(scheme)} scheme={scheme}>
          <Title color="secondary">Example</Title>
          <Title color="#123456">Example</Title>
        </KitThemeProvider>,
      );
      expect(html).toContain(cssColor(resolveColorToken('secondary', scheme)));
      expect(html).toContain(cssColor('#123456'));
    }
  });

  test('a style prop wins over the computed style, as an object or a list', () => {
    const single = renderToStaticMarkup(<Title style={{ fontSize: 13, color: '#abcdef' }}>Example</Title>);
    expect(single).toContain('font-size:13px');
    expect(single).not.toContain('font-size:24px');
    expect(single).toContain(cssColor('#abcdef'));
    const list = renderToStaticMarkup(<Title style={[{ fontSize: 14 }, { lineHeight: 20 }]}>Example</Title>);
    expect(list).toContain('font-size:14px');
    expect(list).toContain('line-height:20px');
  });
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
