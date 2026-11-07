import { afterEach, describe, expect, test } from 'bun:test';
import { KIT_FONT_STYLE_ID, fontFaceCss, loadKitFonts, setKitFontFaces } from '../src/react-native/fonts';

class FakeStyle {
  id = '';
  textContent = '';
}

function installDocument(): FakeStyle[] {
  const styles: FakeStyle[] = [];
  Object.assign(globalThis, {
    HTMLStyleElement: FakeStyle,
    document: {
      getElementById: (id: string) => styles.find((style) => style.id === id) ?? null,
      createElement: () => new FakeStyle(),
      head: { append: (style: FakeStyle) => styles.push(style) },
    },
  });
  return styles;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(globalThis, 'HTMLStyleElement');
});

describe('fontFaceCss', () => {
  test('writes the descriptors that are set, in a fixed order', () => {
    expect(fontFaceCss({ family: 'Calibre-Medium', src: 'url("a.woff2")', weight: '400', display: 'swap', sizeAdjust: '88%' })).toBe(
      '@font-face { font-family: "Calibre-Medium"; src: url("a.woff2"); font-weight: 400; font-display: swap; size-adjust: 88%; }',
    );
    expect(fontFaceCss({ family: 'F', src: 'local("F")', lineGapOverride: '20%', ascentOverride: '80%' })).toBe(
      '@font-face { font-family: "F"; src: local("F"); ascent-override: 80%; line-gap-override: 20%; }',
    );
  });
});

describe('kit font faces on web', () => {
  test('loadKitFonts writes the bundled faces once into the kit style element', () => {
    const styles = installDocument();
    loadKitFonts();
    loadKitFonts();
    expect(styles).toHaveLength(1);
    expect(styles[0]?.id).toBe(KIT_FONT_STYLE_ID);
    expect(styles[0]?.textContent).toContain('font-family: "Calibre-Medium"');
    expect(styles[0]?.textContent).toContain('font-family: "Calibre-Semibold"');
  });

  test('a host choice replaces the faces, and loadKitFonts never rewrites them', () => {
    const styles = installDocument();
    loadKitFonts();
    setKitFontFaces([{ family: 'Calibre-Medium', src: 'local("Inter")' }]);
    loadKitFonts();
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe('@font-face { font-family: "Calibre-Medium"; src: local("Inter"); }');
  });

  test('without a document nothing happens', () => {
    expect(() => {
      setKitFontFaces([{ family: 'F', src: 'local("F")' }]);
      loadKitFonts();
    }).not.toThrow();
  });
});
