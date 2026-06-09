/** Reusable full-screen image viewer modal.
 *
 *  One component for every "open this image large" surface — message image
 *  attachments AND profile/group avatars. Shows the image fit-to-screen on a
 *  near-black backdrop, a close (✕) affordance, and a Download button that
 *  saves the image to the device camera roll via expo-media-library.
 *
 *  Supported source URIs:
 *    - `http(s)://…`  remote — downloaded to a temp file first, then saved.
 *    - `file://…`     already local — saved directly.
 *    - `data:…;base64,…`  inline (XMTP attachments) — bytes written to a temp
 *      file, then saved.
 *
 *  Download UX: requests the media-library write permission on first save,
 *  shows an in-button "Saving…" state, and gives an Android toast / iOS Alert
 *  on success or failure (matching the app's existing `flash` + `Alert`
 *  patterns — there's no iOS toast primitive). */

import { useState } from 'react';

import { Alert, Modal, Platform } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
import { Spinner } from './Spinner';
import * as MediaLibrary from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import { Buffer } from 'buffer';
import { Icon } from '@metro-labs/kit/icon';
import { flash } from '../lib/toast';

/** Extension guessed from a `data:` URI mime or a URL path, used so the saved
 *  asset lands with a sensible suffix (the camera roll cares on some OSes). */
function extOf(uri: string): string {
  const dataMime = /^data:image\/([a-z0-9.+-]+)/i.exec(uri)?.[1];
  if (dataMime) return dataMime === 'jpeg' ? 'jpg' : dataMime;
  const urlExt = /\.([a-z0-9]{3,4})(?:[?#]|$)/i.exec(uri)?.[1];
  return (urlExt ?? 'jpg').toLowerCase();
}

/** Scratch directory for temp downloads — created lazily under the app cache
 *  dir (the OS may reclaim it, which is fine since it's only a staging area for
 *  the save call). We don't bother cleaning up individual files; the volume is
 *  tiny and the cache dir is transient by design. */
function tempDir(): Directory {
  const dir = new Directory(Paths.cache, 'image-viewer');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Resolve `uri` to a local `file://` path suitable for MediaLibrary. Remote
 *  URLs are downloaded; data: URIs are decoded to a temp file; file: URIs pass
 *  through untouched. Returns the local uri. */
async function toLocalUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const ext = extOf(uri);
  if (uri.startsWith('data:')) {
    const b64 = uri.slice(uri.indexOf(',') + 1);
    const file = new File(tempDir(), `img-${Date.now()}.${ext}`);
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(Buffer.from(b64, 'base64')));
    return file.uri;
  }
  // Remote http(s) — download into the temp dir.
  const dest = new File(tempDir(), `img-${Date.now()}.${ext}`);
  const downloaded = await File.downloadFileAsync(uri, dest);
  return downloaded.uri;
}

export function ImageViewer({ uri, visible, onClose }: {
  /** Image source — http(s)://, file://, or data:…;base64,… */
  uri: string;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [saving, setSaving] = useState(false);

  const onDownload = async (): Promise<void> => {
    if (saving || !uri) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save images.');
        return;
      }
      const local = await toLocalUri(uri);
      await MediaLibrary.saveToLibraryAsync(local);
      // `flash` is an Android-only toast (no iOS toast primitive), so give an
      // explicit Alert confirmation on iOS instead.
      if (Platform.OS === 'android') flash('Saved to photos');
      else Alert.alert('Saved', 'Image saved to your photos.');
    } catch (e) {
      Alert.alert('Download failed', (e as Error).message ?? 'Could not save image.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Box style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' }}>
        {/* Tap the backdrop (anywhere not on a control) to dismiss. */}
        <Pressable
          onPress={onClose}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {uri ? (
            <Image src={uri} style={{ width: '100%', height: '100%' }} fit="contain" />
          ) : null}
        </Pressable>

        {/* Close — top-right. */}
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 48, right: 20, padding: 10 }}
          hitSlop={10}
        >
          <Icon name="x" size={28} color="#ffffff" />
        </Pressable>

        {/* Download — bottom-center pill. */}
        <Box style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' }}>
          <Pressable
            onPress={() => { void onDownload(); }}
            disabled={saving}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.14)',
              opacity: pressed ? 0.7 : saving ? 0.6 : 1,
            })}
          >
            {saving
              ? <Spinner size={20} color="#ffffff" />
              : <Icon name="arrowDownTray" size={18} color="#ffffff" />}
            <Text weight="semibold" size="md" style={{ color: '#ffffff' }}>
              {saving ? 'Saving…' : 'Download'}
            </Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}
