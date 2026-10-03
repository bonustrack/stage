import { CP1252_HIGH } from './mimeHeaders';

const NAMED: Readonly<Record<string, number>> = {
  amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, nbsp: 160, iexcl: 161, cent: 162, pound: 163, yen: 165, sect: 167,
  copy: 169, laquo: 171, shy: 173, reg: 174, deg: 176, plusmn: 177, para: 182, middot: 183, raquo: 187, iquest: 191,
  times: 215, divide: 247, szlig: 223, ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, ndash: 8211,
  mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222, bull: 8226,
  hellip: 8230, euro: 8364, trade: 8482, larr: 8592, rarr: 8594, check: 10003,
};

const LATIN_LETTERS: Readonly<Record<string, number>> = {
  agrave: 224, aacute: 225, acirc: 226, atilde: 227, auml: 228, aring: 229, aelig: 230, ccedil: 231, egrave: 232,
  eacute: 233, ecirc: 234, euml: 235, igrave: 236, iacute: 237, icirc: 238, iuml: 239, ntilde: 241, ograve: 242,
  oacute: 243, ocirc: 244, otilde: 245, ouml: 246, oslash: 248, ugrave: 249, uacute: 250, ucirc: 251, uuml: 252,
  yacute: 253,
};

const ENTITY = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g;

function namedCode(name: string): number | undefined {
  const lower = LATIN_LETTERS[name];
  if (lower !== undefined) return lower;
  const head = name.slice(0, 1);
  const upper = LATIN_LETTERS[head.toLowerCase() + name.slice(1)];
  return upper !== undefined && head !== head.toLowerCase() ? upper - 32 : NAMED[name];
}

function codePointText(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd';
  return String.fromCodePoint(CP1252_HIGH[code] ?? code);
}

function entityText(whole: string, ref: string): string {
  if (ref.startsWith('#x') || ref.startsWith('#X')) return codePointText(Number.parseInt(ref.slice(2), 16));
  if (ref.startsWith('#')) return codePointText(Number.parseInt(ref.slice(1), 10));
  const code = namedCode(ref);
  return code === undefined ? whole : String.fromCharCode(code);
}

export function decodeEntities(text: string): string {
  return text.includes('&') ? text.replace(ENTITY, entityText) : text;
}
