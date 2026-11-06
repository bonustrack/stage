import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KitThemeProvider, useKitColors, type KitColors, type KitPaletteMode } from '../src/react-native/theme-context';
import { colors, kitPalette, schemePalette, type KitPalette } from '../src/tokens';

const CUSTOM: KitPalette = { ...kitPalette('dark'), bg: '#101820', link: '#ff6600', border: '#222324' };

function colorsFor(dark: boolean | undefined, mode: KitPaletteMode): KitColors {
  const box: { value?: KitColors } = {};
  function Probe(): null {
    box.value = useKitColors(dark, mode);
    return null;
  }
  renderToStaticMarkup(
    <KitThemeProvider value={CUSTOM} scheme="dark">
      <Probe />
    </KitThemeProvider>,
  );
  if (box.value === undefined) throw new Error('the hook returned nothing');
  return box.value;
}

describe('schemePalette', () => {
  test('keeps the static colours it always had', () => {
    for (const [dark, k] of [
      [true, 'dark'],
      [false, 'light'],
    ] as const) {
      expect(schemePalette(dark)).toEqual({
        head: colors[`head-${k}`],
        text: colors[`fg-${k}`],
        sub: colors[`sub-${k}`],
        surface: colors[`hover-${k}`],
        pressed: colors[`hover-${k}`],
        border: colors[`border-${k}`],
      });
    }
  });
});

describe('useKitColors', () => {
  test('provider follows the provider unless a scheme is forced', () => {
    expect(colorsFor(undefined, 'provider').palette).toEqual(CUSTOM);
    expect(colorsFor(true, 'provider').palette).toEqual(kitPalette('dark'));
  });

  test('matching follows the provider whenever the scheme matches it', () => {
    expect(colorsFor(true, 'matching').palette).toEqual(CUSTOM);
    expect(colorsFor(false, 'matching')).toMatchObject({ scheme: 'light', dark: false, palette: kitPalette('light') });
  });

  test('static reads the fixed palette of the effective scheme', () => {
    expect(colorsFor(undefined, 'static')).toMatchObject({ scheme: 'dark', dark: true, palette: kitPalette('dark') });
    expect(colorsFor(undefined, 'static').roles).toEqual(schemePalette(true));
  });
});
