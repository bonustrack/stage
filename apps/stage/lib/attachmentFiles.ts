
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

function mimeFromName(name: string): string {
  return EXT_MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export function attachmentMimeType(mimeType: string | undefined, filename: string): string {
  return mimeType?.includes('/') ? mimeType : mimeFromName(filename);
}

export function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime?.includes('/')) return mime;
  return mimeFromName(nameOrUri.split('?')[0]?.split('#')[0] ?? '');
}

export async function fileUriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (typeof result !== 'string') { reject(new Error('FileReader returned non-string')); return; }
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = (): void => { reject(reader.error ?? new Error('FileReader failed')); };
    reader.readAsDataURL(blob);
  });
}
