import { Alert, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import { base64ToBytes } from '@stage-labs/client/text/base64';
import { capabilities } from './capabilities';
import { imageFileName } from './imageDownload.model';

function tempDir(): Directory {
  const dir = new Directory(Paths.cache, 'image-viewer');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function toLocalUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const file = new File(tempDir(), imageFileName(uri, undefined, Date.now()));
  if (uri.startsWith('data:')) {
    if (file.exists) file.delete();
    file.create();
    file.write(base64ToBytes(uri.slice(uri.indexOf(',') + 1)));
    return file.uri;
  }
  const downloaded = await File.downloadFileAsync(uri, file);
  return downloaded.uri;
}

export async function downloadImage(uri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo library access to save images.');
    return;
  }
  await MediaLibrary.saveToLibraryAsync(await toLocalUri(uri));
  if (Platform.OS === 'android') capabilities.toast('Saved to photos');
  else Alert.alert('Saved', 'Image saved to your photos.');
}
