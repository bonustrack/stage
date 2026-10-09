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

const TAB_VIEWABLE = /^(application\/pdf|text\/)/i;

function isViewableInTab(mime: string | undefined): mime is string {
  return mime !== undefined && TAB_VIEWABLE.test(mime);
}

function tabMime(mime: string): string {
  return /^text\//i.test(mime) && !/charset=/i.test(mime) ? `${mime};charset=utf-8` : mime;
}

function inlineBytes(url: string): Uint8Array | null {
  if (!url.startsWith('data:')) return null;
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) return null;
  return base64ToBytes(url.slice(comma + 1));
}

export function fileOpenAction(file: OpenableFile): FileOpenAction {
  const mime = file.mime;
  if (!isViewableInTab(mime)) return { kind: 'download' };
  const bytes = inlineBytes(file.url);
  return bytes === null ? { kind: 'open', url: file.url } : { kind: 'openInline', bytes, mime: tabMime(mime) };
}
