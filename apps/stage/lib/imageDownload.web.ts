import { ignored } from './errorPolicy';
import { imageFileName } from './imageDownload.model';

const REVOKE_AFTER_MS = 60_000;

async function fetchImage(uri: string): Promise<Blob | null> {
  const res = await fetch(uri).catch(ignored(null, 'probe'));
  return res?.ok === true ? res.blob() : null;
}

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

export async function downloadImage(uri: string): Promise<void> {
  const blob = await fetchImage(uri);
  if (blob !== null) {
    saveBlob(blob, imageFileName(uri, blob.type, Date.now()));
    return;
  }
  if (!/^https?:/i.test(uri)) throw new Error('Could not read this image.');
  window.open(uri, '_blank', 'noopener');
}
