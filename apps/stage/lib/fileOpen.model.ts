import { base64ToBytes } from '@stage-labs/client/text/base64';

export interface OpenableFile {
  url: string;
  mime?: string;
  name: string;
}

type FileOpenAction =
  | { kind: 'download' }
  | { kind: 'open'; url: string }
  | { kind: 'openBlob'; url: string; mime: string }
  | { kind: 'openInline'; bytes: Uint8Array; mime: string };

const INERT_MEDIA = /^(image\/(png|jpe?g|gif|webp|avif|bmp|heic|heif)|video\/[a-z0-9.-]+|audio\/[a-z0-9.-]+)$/;
const CHARSET = /(?:^|;)\s*charset=([a-z0-9_-]+)/i;

export function inertBlobType(mime: string | undefined): string {
  const base = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (INERT_MEDIA.test(base) || base === 'application/pdf') return base;
  if (base.startsWith('text/')) return `text/plain;charset=${CHARSET.exec(mime ?? '')?.[1] ?? 'utf-8'}`;
  return 'application/octet-stream';
}

function inlineBytes(url: string): Uint8Array | null {
  if (!url.startsWith('data:')) return null;
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) return null;
  return base64ToBytes(url.slice(comma + 1));
}

export function fileOpenAction(file: OpenableFile): FileOpenAction {
  const type = inertBlobType(file.mime);
  if (type !== 'application/pdf' && !type.startsWith('text/plain')) return { kind: 'download' };
  if (file.url.startsWith('blob:')) return { kind: 'openBlob', url: file.url, mime: type };
  const bytes = inlineBytes(file.url);
  return bytes === null ? { kind: 'open', url: file.url } : { kind: 'openInline', bytes, mime: type };
}

const FILE_EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/zip': 'zip',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};
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

function readableName(name: string): string {
  const kept = Array.from(name, (c) => (hiddenOrReserved(c) ? '_' : c)).join('');
  const trimmed = kept.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const safe = trimmed === '' ? 'attachment' : trimmed;
  return fitBytes(WINDOWS_DEVICE.test(safe) ? `_${safe}` : safe);
}

function baseMime(mime: string | undefined): string {
  return (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

export function nativeFileName(name: string, mime: string | undefined): string {
  const clean = readableName(name);
  if (/\.[a-z0-9]{1,8}$/i.test(clean)) return clean;
  const ext = FILE_EXTENSIONS[baseMime(mime)];
  return ext === undefined ? clean : fitBytes(`${clean}.${ext}`);
}

export function normalizedMime(mime: string | undefined, name: string): string {
  const base = baseMime(mime);
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(base)) return base;
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return Object.entries(FILE_EXTENSIONS).find(([, value]) => value === ext)?.[0] ?? 'application/octet-stream';
}
