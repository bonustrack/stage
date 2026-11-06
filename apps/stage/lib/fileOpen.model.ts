import { baseMime, dataUrlBytes } from '@stage-labs/client/files';

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
  const base = baseMime(mime);
  if (INERT_MEDIA.test(base) || base === 'application/pdf') return base;
  if (base.startsWith('text/')) return `text/plain;charset=${CHARSET.exec(mime ?? '')?.[1] ?? 'utf-8'}`;
  return 'application/octet-stream';
}

export function fileOpenAction(file: OpenableFile): FileOpenAction {
  const type = inertBlobType(file.mime);
  if (type !== 'application/pdf' && !type.startsWith('text/plain')) return { kind: 'download' };
  if (file.url.startsWith('blob:')) return { kind: 'openBlob', url: file.url, mime: type };
  const bytes = dataUrlBytes(file.url);
  return bytes === null ? { kind: 'open', url: file.url } : { kind: 'openInline', bytes, mime: type };
}
