import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { startActivityAsync } from 'expo-intent-launcher';
import { shareAsync } from 'expo-sharing';
import { base64ToBytes } from '@stage-labs/client/text/base64';
import { attempt, ignored, reported } from './errorPolicy';
import { nativeFileName, type OpenableFile } from './fileOpen.model';

const VIEW_ACTION = 'android.intent.action.VIEW';
const GRANT_READ_URI_PERMISSION = 1;

function openDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'open');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function localCopy(file: OpenableFile): File {
  const dest = new File(openDirectory(), nativeFileName(file.name, file.mime));
  if (dest.exists) attempt(() => { dest.delete(); }, 'cleanup');
  if (file.url.startsWith('data:')) {
    dest.create();
    dest.write(base64ToBytes(file.url.slice(file.url.indexOf(',') + 1)));
  } else {
    new File(file.url).copySync(dest);
  }
  return dest;
}

async function viewOnAndroid(uri: string, mime: string): Promise<boolean> {
  const data = await getContentUriAsync(uri);
  return startActivityAsync(VIEW_ACTION, { data, type: mime, flags: GRANT_READ_URI_PERMISSION })
    .then(() => true)
    .catch(ignored(false, 'optional'));
}

async function openNative(file: OpenableFile): Promise<void> {
  const local = localCopy(file);
  const mime = file.mime ?? 'application/octet-stream';
  if (Platform.OS === 'android' && await viewOnAndroid(local.uri, mime)) return;
  await shareAsync(local.uri, { mimeType: mime, dialogTitle: file.name });
}

export function openFile(file: OpenableFile): void {
  void openNative(file).catch(reported('file.open'));
}
