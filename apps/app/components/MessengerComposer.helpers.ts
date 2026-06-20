/** @file Shared types (Attachment, Palette) and pure helpers (MIME resolution, inline-attachment size guard) for the MessengerComposer. */

/** Composer-local representation of a staged attachment. `url` is a `file://` URI in xmtp mode (the only mode the mobile composer supports now). `id` is a client-side dedupe key. */
export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

/** Shared color palette threaded into the composer's builder sheets. */
export interface Palette { fg: string; sub: string; inputBg: string; chipBg: string }

/** Map a file extension → MIME type for the formats the composer can stage. The voice recorder writes `.m4a` (AAC) and image pickers can hand back HEIC/PNG etc. with a missing `mimeType`, so we need a deterministic fallback. */
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

/** Resolve a usable MIME for a staged file, preferring the supplied `mime` but falling back to the file extension then a generic binary type, since pickers/recorders often return empty and that breaks the kind bucket and native encrypt/IPFS upload. */
export function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime?.includes('/')) return mime;
  const ext = nameOrUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** Inline attachments are encrypted into the MLS envelope (libxmtp ~1 MB cap), so guard below that with codec-overhead headroom to fail fast with a clear message; the larger-file multi-remote path is currently disabled because the upload endpoint rejects ciphertext. */
export const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;
