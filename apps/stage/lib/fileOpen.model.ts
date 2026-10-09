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
const NAME_RESERVED = '/\\:*?"<>|';
const MAX_NAME_LENGTH = 120;

function readableName(name: string): string {
  const kept = Array.from(name, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || NAME_RESERVED.includes(c) ? '_' : c)).join('');
  const trimmed = kept.replace(/^[.\s]+/, '').trim().slice(-MAX_NAME_LENGTH);
  return trimmed === '' ? 'attachment' : trimmed;
}

export function nativeFileName(name: string, mime: string | undefined): string {
  const clean = readableName(name);
  if (/\.[a-z0-9]{1,8}$/i.test(clean)) return clean;
  const ext = FILE_EXTENSIONS[(mime ?? '').split(';')[0]?.trim().toLowerCase() ?? ''];
  return ext === undefined ? clean : `${clean}.${ext}`;
}
