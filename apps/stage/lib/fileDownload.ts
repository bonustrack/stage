import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import { dataUrlBytes, nativeFileName } from '@stage-labs/client/files';
import { capabilities } from './capabilities';
import { ignored } from './errorPolicy';
import { imageFileName } from './imageDownload.model';

function cacheDir(name: string): Directory {
  const dir = new Directory(Paths.cache, name);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function inlineBytes(uri: string, unreadable: string): Uint8Array {
  const bytes = dataUrlBytes(uri);
  if (bytes === null) throw new Error(unreadable);
  return bytes;
}

async function readBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) return inlineBytes(uri, 'Could not read this file.');
  if (uri.startsWith('file://')) return new File(uri).bytes();
  const downloaded = await File.downloadFileAsync(uri, new File(cacheDir('downloads'), String(Date.now())));
  const bytes = await downloaded.bytes();
  downloaded.delete();
  return bytes;
}

export async function downloadFile(uri: string, name: string, mime?: string): Promise<void> {
  const target = await Directory.pickDirectoryAsync().catch(ignored(null, 'ui'));
  if (target === null) return;
  const bytes = await readBytes(uri);
  const fileName = nativeFileName(name, mime);
  target.createFile(fileName, mime ?? null).write(bytes);
  capabilities.toast(`Saved ${fileName}`);
}

async function toLocalUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const file = new File(cacheDir('image-viewer'), imageFileName(uri, undefined, Date.now()));
  if (uri.startsWith('data:')) {
    const bytes = inlineBytes(uri, 'Could not read this image.');
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return file.uri;
  }
  return (await File.downloadFileAsync(uri, file)).uri;
}

export async function downloadImage(uri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    capabilities.alert('Permission needed', 'Allow photo library access to save images.');
    return;
  }
  await MediaLibrary.saveToLibraryAsync(await toLocalUri(uri));
  if (Platform.OS === 'android') capabilities.toast('Saved to photos');
  else capabilities.alert('Saved', 'Image saved to your photos.');
}
