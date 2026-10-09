import { base64ToBytes } from '@stage-labs/client/text/base64';

export interface OpenableFile {
  url: string;
  mime?: string;
  name: string;
}

type FileOpenAction =
  | { kind: 'download' }
  | { kind: 'open'; url: string }
  | { kind: 'openInline'; bytes: Uint8Array; mime: string };

const INERT_MEDIA = /^(image\/(png|jpe?g|gif|webp|avif|bmp|heic|heif)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+)$/;
const CHARSET = /charset=([a-z0-9_-]+)/i;

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
  const bytes = inlineBytes(file.url);
  return bytes === null ? { kind: 'open', url: file.url } : { kind: 'openInline', bytes, mime: type };
}
