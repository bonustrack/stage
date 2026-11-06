import { KIT_FONT_FACES, KIT_FONT_STYLE_ID, fontFaceCss, type KitFontFace } from './fonts.faces';

function styleElement(doc: Document): HTMLStyleElement {
  const found = doc.getElementById(KIT_FONT_STYLE_ID);
  if (found instanceof HTMLStyleElement) return found;
  const style = doc.createElement('style');
  style.id = KIT_FONT_STYLE_ID;
  doc.head.append(style);
  return style;
}

export function setKitFontFaces(faces: readonly KitFontFace[]): void {
  if (typeof document === 'undefined') return;
  styleElement(document).textContent = faces.map(fontFaceCss).join('\n');
}

export function loadKitFonts(): void {
  if (typeof document === 'undefined' || document.getElementById(KIT_FONT_STYLE_ID)) return;
  setKitFontFaces(KIT_FONT_FACES);
}
