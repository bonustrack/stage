export const OPEN_FILE_CHANNEL = 'stage:open-file';
export const MAX_OPEN_BYTES = 100_000_000;
export const TEMP_PREFIX = 'stage-open-';

const OPEN_IN_APP = new Set(['pdf', 'txt', 'log', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'mp3', 'm4a', 'wav', 'mp4', 'mov']);
const RESERVED = '/\\:*?"<>|';
const HIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x61c, 0x61c],
  [0x200b, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff],
];
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
const MAX_NAME_BYTES = 200;

function hiddenOrReserved(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  return RESERVED.includes(c) || HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);
}

function fitBytes(name: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(name).length <= MAX_NAME_BYTES) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : '';
  let base = Array.from(name.slice(0, name.length - ext.length));
  while (base.length > 0 && encoder.encode(`${base.join('')}${ext}`).length > MAX_NAME_BYTES) base = base.slice(0, -1);
  return `${base.join('')}${ext}`;
}

export function savedFileName(name: string): string {
  const kept = Array.from(name, (c) => (hiddenOrReserved(c) ? '_' : c)).join('');
  const trimmed = kept.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const safe = trimmed === '' ? 'attachment' : trimmed;
  return fitBytes(WINDOWS_DEVICE.test(safe) ? `_${safe}` : safe);
}

export function opensInApp(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && OPEN_IN_APP.has(name.slice(dot + 1).toLowerCase());
}
