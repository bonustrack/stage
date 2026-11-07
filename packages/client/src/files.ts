import { base64ToBytes } from './text/base64';

export type FileUse = 'send' | 'open' | 'kind' | 'record' | 'save' | 'mail' | 'strip';

export type MediaKind = 'image' | 'audio' | 'video';

interface FileType {
  ext: string;
  mime: string;
  uses: readonly FileUse[];
}

const FILE_TYPES: readonly FileType[] = [
  { ext: 'jpg', mime: 'image/jpeg', uses: ['send', 'open', 'kind', 'save', 'mail', 'strip'] },
  { ext: 'jpeg', mime: 'image/jpeg', uses: ['send', 'kind', 'strip'] },
  { ext: 'jpg', mime: 'image/jpg', uses: ['strip'] },
  { ext: 'png', mime: 'image/png', uses: ['send', 'open', 'kind', 'save', 'mail', 'strip'] },
  { ext: 'gif', mime: 'image/gif', uses: ['send', 'open', 'kind', 'save', 'mail'] },
  { ext: 'webp', mime: 'image/webp', uses: ['send', 'open', 'kind', 'save', 'mail', 'strip'] },
  { ext: 'heic', mime: 'image/heic', uses: ['send', 'open', 'kind', 'save'] },
  { ext: 'heif', mime: 'image/heif', uses: ['send', 'save'] },
  { ext: 'avif', mime: 'image/avif', uses: ['send', 'kind', 'save'] },
  { ext: 'bmp', mime: 'image/bmp', uses: ['send', 'save'] },
  { ext: 'svg', mime: 'image/svg+xml', uses: ['save'] },
  { ext: 'm4a', mime: 'audio/m4a', uses: ['send', 'kind', 'record'] },
  { ext: 'm4a', mime: 'audio/mp4', uses: ['open', 'record'] },
  { ext: 'm4a', mime: 'audio/x-m4a', uses: ['record'] },
  { ext: 'mp3', mime: 'audio/mpeg', uses: ['send', 'open', 'kind'] },
  { ext: 'wav', mime: 'audio/wav', uses: ['send', 'kind', 'record'] },
  { ext: 'aac', mime: 'audio/aac', uses: ['send', 'kind', 'record'] },
  { ext: 'ogg', mime: 'audio/ogg', uses: ['send', 'kind', 'record'] },
  { ext: 'caf', mime: 'audio/x-caf', uses: ['send'] },
  { ext: 'webm', mime: 'audio/webm', uses: ['record'] },
  { ext: 'mp4', mime: 'video/mp4', uses: ['send', 'open', 'kind'] },
  { ext: 'mov', mime: 'video/quicktime', uses: ['send', 'open', 'kind'] },
  { ext: 'webm', mime: 'video/webm', uses: ['send', 'kind'] },
  { ext: 'pdf', mime: 'application/pdf', uses: ['send', 'open', 'mail'] },
  { ext: 'txt', mime: 'text/plain', uses: ['open', 'mail'] },
  { ext: 'html', mime: 'text/html', uses: ['mail'] },
  { ext: 'ics', mime: 'text/calendar', uses: ['mail'] },
  { ext: 'eml', mime: 'message/rfc822', uses: ['mail'] },
  { ext: 'csv', mime: 'text/csv', uses: ['open'] },
  { ext: 'md', mime: 'text/markdown', uses: ['open'] },
  { ext: 'json', mime: 'application/json', uses: ['open'] },
  { ext: 'zip', mime: 'application/zip', uses: ['open'] },
];

export const UNKNOWN_MIME = 'application/octet-stream';

export function mimeForExtension(ext: string, use: FileUse): string | undefined {
  return FILE_TYPES.find((type) => type.ext === ext && type.uses.includes(use))?.mime;
}

export function extensionForMime(mime: string, use: FileUse): string | undefined {
  return FILE_TYPES.find((type) => type.mime === mime && type.uses.includes(use))?.ext;
}

export function kindExtensions(kind: MediaKind): string[] {
  return FILE_TYPES.filter((type) => type.uses.includes('kind') && type.mime.startsWith(`${kind}/`)).map((type) => type.ext);
}

export function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function withoutQuery(uri: string): string {
  return uri.split('?')[0]?.split('#')[0] ?? '';
}

export function baseMime(mime: string | undefined): string {
  return (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

export function dataUrlBytes(url: string): Uint8Array | null {
  if (!url.startsWith('data:')) return null;
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) return null;
  return base64ToBytes(url.slice(comma + 1));
}

const RESERVED = '/\\:*?"<>|';
const HIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [0x0, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x61c, 0x61c],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
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

function readableName(name: string): string {
  const kept = Array.from(name, (c) => (hiddenOrReserved(c) ? '_' : c)).join('');
  const trimmed = kept.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const safe = trimmed === '' ? 'attachment' : trimmed;
  return fitBytes(WINDOWS_DEVICE.test(safe) ? `_${safe}` : safe);
}

export function nativeFileName(name: string, mime: string | undefined): string {
  const clean = readableName(name);
  if (/\.[a-z0-9]{1,8}$/i.test(clean)) return clean;
  const ext = extensionForMime(baseMime(mime), 'open');
  return ext === undefined ? clean : fitBytes(`${clean}.${ext}`);
}

export function normalizedMime(mime: string | undefined, name: string): string {
  const base = baseMime(mime);
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(base)) return base;
  return mimeForExtension(fileExtension(name), 'open') ?? UNKNOWN_MIME;
}
