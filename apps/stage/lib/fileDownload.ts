import { Directory, File, Paths } from 'expo-file-system';
import { base64ToBytes } from '@stage-labs/client/text/base64';
import { capabilities } from './capabilities';
import { ignored } from './errorPolicy';

async function readBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) return base64ToBytes(uri.slice(uri.indexOf(',') + 1));
  if (uri.startsWith('file://')) return new File(uri).bytes();
  const cache = new Directory(Paths.cache, 'downloads');
  if (!cache.exists) cache.create({ intermediates: true });
  const downloaded = await File.downloadFileAsync(uri, new File(cache, String(Date.now())));
  const bytes = await downloaded.bytes();
  downloaded.delete();
  return bytes;
}

export async function downloadFile(uri: string, name: string, mime?: string): Promise<void> {
  const target = await Directory.pickDirectoryAsync().catch(ignored(null, 'ui'));
  if (target === null) return;
  const bytes = await readBytes(uri);
  target.createFile(name, mime ?? null).write(bytes);
  capabilities.toast(`Saved ${name}`);
}
