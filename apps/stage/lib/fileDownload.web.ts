import { ignored } from './errorPolicy';
import { imageFileName } from './imageDownload.model';

const REVOKE_AFTER_MS = 60_000;

function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => { URL.revokeObjectURL(href); }, REVOKE_AFTER_MS);
}

async function saveOrOpen(uri: string, nameOf: (blob: Blob) => string, unreadable: string): Promise<void> {
  const res = await fetch(uri).catch(ignored(null, 'probe'));
  if (res?.ok === true) {
    const blob = await res.blob();
    saveBlob(blob, nameOf(blob));
    return;
  }
  if (!/^https?:/i.test(uri)) throw new Error(unreadable);
  window.open(uri, '_blank', 'noopener');
}

export function downloadFile(uri: string, name: string): Promise<void> {
  return saveOrOpen(uri, () => name, 'Could not read this file.');
}

export function downloadImage(uri: string): Promise<void> {
  return saveOrOpen(uri, (blob) => imageFileName(uri, blob.type, Date.now()), 'Could not read this image.');
}
