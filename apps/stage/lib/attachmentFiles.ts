import { UNKNOWN_MIME, extensionForMime, fileExtension, mimeForExtension, withoutQuery } from '@stage-labs/client/files';

function mimeFromName(name: string): string {
  return mimeForExtension(fileExtension(name), 'send') ?? UNKNOWN_MIME;
}

export function attachmentMimeType(mimeType: string | undefined, filename: string): string {
  return mimeType?.includes('/') ? mimeType : mimeFromName(filename);
}

export function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime?.includes('/')) return mime;
  return mimeFromName(withoutQuery(nameOrUri));
}

interface OutgoingFile {
  id: string;
  url: string;
  mime?: string;
  name?: string;
}

export function outgoingFileMeta(at: OutgoingFile): { mimeType: string; filename: string } {
  const mimeType = mimeOf(at.mime, at.name ?? at.url);
  return { mimeType, filename: withExtension(at.name ?? at.id, mimeType) };
}

function withExtension(name: string, mimeType: string): string {
  if (name.includes('.')) return name;
  const ext = extensionForMime(mimeType, 'send');
  return ext ? `${name}.${ext}` : name;
}
