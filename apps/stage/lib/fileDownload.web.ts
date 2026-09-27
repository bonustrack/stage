import { ignored } from './errorPolicy';
import { saveBlob } from './saveBlob';

export async function downloadFile(uri: string, name: string): Promise<void> {
  const res = await fetch(uri).catch(ignored(null, 'probe'));
  if (res?.ok === true) {
    saveBlob(await res.blob(), name);
    return;
  }
  if (!/^https?:/i.test(uri)) throw new Error('Could not read this file.');
  window.open(uri, '_blank', 'noopener');
}
