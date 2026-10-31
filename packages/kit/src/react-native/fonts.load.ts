import { KIT_FONT_STYLE_ID, KIT_FONTS } from './fonts';

function addFontFaces(doc: Document): void {
  if (doc.getElementById(KIT_FONT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = KIT_FONT_STYLE_ID;
  style.textContent = Object.entries(KIT_FONTS)
    .map(([family, source]) => `@font-face { font-family: '${family}'; src: url('${source}') format('truetype'); }`)
    .join('\n');
  doc.head.appendChild(style);
}

export function loadKitFonts(): void {
  if (typeof document !== 'undefined') addFontFaces(document);
}
