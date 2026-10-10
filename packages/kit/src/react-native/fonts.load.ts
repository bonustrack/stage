import { KIT_FONTS } from './fonts';

const STYLE_ID = 'stage-kit-fonts';

function addFontFaces(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = Object.entries(KIT_FONTS)
    .map(([family, source]) => `@font-face { font-family: '${family}'; src: url('${source}') format('truetype'); }`)
    .join('\n');
  doc.head.appendChild(style);
}

export function loadKitFonts(): void {
  if (typeof document !== 'undefined') addFontFaces(document);
}
