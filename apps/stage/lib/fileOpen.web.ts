import { capabilities } from './capabilities';
import { reported } from './errorPolicy';
import { downloadFile } from './fileDownload';
import { fileOpenAction, type OpenableFile } from './fileOpen.model';

const inlineUrls = new Map<string, string>();

function blobUrlFor(dataUrl: string, bytes: Uint8Array, mime: string): string {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  inlineUrls.set(dataUrl, url);
  return url;
}

export function openFile(file: OpenableFile): void {
  const cached = inlineUrls.get(file.url);
  if (cached !== undefined) {
    capabilities.openUrl(cached);
    return;
  }
  const action = fileOpenAction(file);
  if (action.kind === 'download') {
    void downloadFile(file.url, file.name).catch(reported('file.download'));
    return;
  }
  capabilities.openUrl(action.kind === 'open' ? action.url : blobUrlFor(file.url, action.bytes, action.mime));
}
