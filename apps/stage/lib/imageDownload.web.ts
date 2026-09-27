import { ignored } from './errorPolicy';
import { imageFileName } from './imageDownload.model';
import { saveBlob } from './saveBlob';

async function fetchImage(uri: string): Promise<Blob | null> {
  const res = await fetch(uri).catch(ignored(null, 'probe'));
  return res?.ok === true ? res.blob() : null;
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
