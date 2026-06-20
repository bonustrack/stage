
export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

export interface Palette { fg: string; sub: string; inputBg: string; chipBg: string }

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

export function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime?.includes('/')) return mime;
  const ext = nameOrUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;
