import { base64ToBytes } from '../text/base64';

export type MailHeaders = ReadonlyMap<string, string>;

export interface HeaderParams {
  value: string;
  params: ReadonlyMap<string, string>;
}

export interface MailAddress {
  name: string;
  address: string;
}

const CHUNK = 0x8000;

export const CP1252_HIGH: Readonly<Record<number, number>> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

const UTF8_NAMES: ReadonlySet<string> = new Set(['', 'utf-8', 'utf8', 'us-ascii', 'ascii']);
const WINDOWS_1252_NAMES: ReadonlySet<string> = new Set([
  'iso-8859-1', 'iso8859-1', 'iso_8859-1', 'latin1', 'l1', 'windows-1252', 'cp1252', 'x-cp1252',
]);

const ENCODED_WORD = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;
const BETWEEN_WORDS = /(=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)\s+(?==\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)/g;
const EXTENDED_PARAM = /^([^*]+)(?:\*(\d+))?(\*)?$/;

export function binaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return out;
}

export function binaryBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function windows1252(bytes: Uint8Array): string {
  const codes = Array.from(bytes, (byte) => CP1252_HIGH[byte] ?? byte);
  let out = '';
  for (let i = 0; i < codes.length; i += CHUNK) out += String.fromCharCode(...codes.slice(i, i + CHUNK));
  return out;
}

function namedDecoder(name: string, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(name).decode(bytes);
  } catch {
    return null;
  }
}

export function decodeCharset(bytes: Uint8Array, charset: string): string {
  const name = charset.trim().replace(/^"|"$/g, '').toLowerCase();
  if (WINDOWS_1252_NAMES.has(name)) return windows1252(bytes);
  const other = UTF8_NAMES.has(name) ? null : namedDecoder(name, bytes);
  return other ?? new TextDecoder().decode(bytes);
}

export function decodeBase64Loose(text: string): Uint8Array {
  let clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  if (clean.length % 4 === 1) clean = clean.slice(0, -1);
  return base64ToBytes(clean + '='.repeat((4 - (clean.length % 4)) % 4));
}

function hexByte(_match: string, hex: string): string {
  return String.fromCharCode(parseInt(hex, 16));
}

export function decodeQuotedPrintable(text: string): string {
  return text.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, hexByte);
}

function decodeWord(_match: string, charset: string, encoding: string, data: string): string {
  const bytes = encoding.toLowerCase() === 'b'
    ? decodeBase64Loose(data)
    : binaryBytes(data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, hexByte));
  return decodeCharset(bytes, charset.split('*')[0] ?? '');
}

export function decodeWords(text: string): string {
  if (!text.includes('=?')) return text;
  return text.replace(BETWEEN_WORDS, '$1').replace(ENCODED_WORD, decodeWord);
}

export function headerBytesText(binary: string): string {
  if (!/[\x80-\xff]/.test(binary)) return binary;
  const bytes = binaryBytes(binary);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return windows1252(bytes);
  }
}

export function headerText(binary: string): string {
  return decodeWords(headerBytesText(binary)).trim();
}

export function parseHeaderBlock(block: string): MailHeaders {
  const headers = new Map<string, string>();
  for (const line of block.replace(/\r?\n(?=[ \t])/g, '').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    const name = line.slice(0, Math.max(colon, 0)).trim().toLowerCase();
    if (colon > 0 && !headers.has(name)) headers.set(name, line.slice(colon + 1).trim());
  }
  return headers;
}

function splitParams(header: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const ch of header) {
    const split = ch === ';' && !quoted;
    if (!escaped && ch === '"') quoted = !quoted;
    escaped = quoted && !escaped && ch === '\\';
    if (split) parts.push(current);
    current = split ? '' : current + ch;
  }
  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  return trimmed.slice(1, -1).replace(/\\(.)/g, '$1');
}

interface ParamSection { value: string; extended: boolean }

function percentBytes(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, hexByte);
}

function joinSections(sections: ReadonlyMap<number, ParamSection>): string {
  const ordered = [...sections.entries()].sort((a, b) => a[0] - b[0]).map(([, section]) => section);
  const first = ordered[0];
  if (first === undefined || !ordered.some((section) => section.extended)) {
    return decodeWords(headerBytesText(ordered.map((section) => section.value).join('')));
  }
  const quote = first.extended ? first.value.split('\'') : [];
  const charset = quote.length >= 3 ? quote[0] ?? '' : 'utf-8';
  const head = quote.length >= 3 ? quote.slice(2).join('\'') : first.value;
  const rest = ordered.slice(1).map((section) => (section.extended ? percentBytes(section.value) : section.value));
  const binary = (first.extended ? percentBytes(head) : head) + rest.join('');
  return decodeCharset(binaryBytes(binary), charset);
}

function addSection(groups: Map<string, Map<number, ParamSection>>, key: string, value: string): void {
  const match = EXTENDED_PARAM.exec(key);
  const name = match?.[1];
  if (match === null || name === undefined) return;
  const index = match[2] === undefined ? 0 : Number(match[2]);
  const extended = match[3] === '*';
  const sections = groups.get(name) ?? new Map<number, ParamSection>();
  if (extended || !sections.has(index)) sections.set(index, { value: extended ? value : unquote(value), extended });
  groups.set(name, sections);
}

export function parseParams(header: string): HeaderParams {
  const [first = '', ...rest] = splitParams(header);
  const groups = new Map<string, Map<number, ParamSection>>();
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq > 0) addSection(groups, part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  const params = new Map<string, string>();
  for (const [name, sections] of groups) params.set(name, joinSections(sections));
  return { value: first.trim().toLowerCase(), params };
}

const ADDRESS_MAX_CHARS = 1000;

export function parseAddress(value: string): MailAddress {
  const text = value.slice(0, ADDRESS_MAX_CHARS).trim();
  const angled = /^(?:"((?:[^"\\]|\\.)*)"|([^<]*?))\s*<([^<>]*)>/.exec(text);
  if (angled !== null) {
    const name = angled[1] === undefined ? angled[2] ?? '' : angled[1].replace(/\\(.)/g, '$1');
    return { name: name.trim(), address: (angled[3] ?? '').trim() };
  }
  const commented = /^([^\s(,]+)\s*\(([^)]*)\)/.exec(text);
  if (commented !== null) return { name: (commented[2] ?? '').trim(), address: commented[1] ?? '' };
  return { name: '', address: text.split(',')[0]?.trim() ?? '' };
}
