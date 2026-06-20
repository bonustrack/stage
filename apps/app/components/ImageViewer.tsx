
import { useState } from 'react';

import { Alert, Modal, Platform } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Image } from '@stage-labs/kit/image';
import { Text } from '@stage-labs/kit/text';
import { Box, Col } from './layout';
import { Spinner } from './Spinner';
import * as MediaLibrary from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import { Buffer } from 'buffer';
import { Icon } from '@stage-labs/kit/icon';
import { flash } from '../lib/toast';

function extOf(uri: string): string {
  const dataMime = /^data:image\/([a-z0-9.+-]+)/i.exec(uri)?.[1];
  if (dataMime) return dataMime === 'jpeg' ? 'jpg' : dataMime;
  const urlExt = /\.([a-z0-9]{3,4})(?:[?#]|$)/i.exec(uri)?.[1];
  return (urlExt ?? 'jpg').toLowerCase();
}

function tempDir(): Directory {
  const dir = new Directory(Paths.cache, 'image-viewer');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

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
  const dest = new File(tempDir(), `img-${Date.now()}.${ext}`);
  const downloaded = await File.downloadFileAsync(uri, dest);
  return downloaded.uri;
}

export function ImageViewer({ uri, visible, onClose }: {
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
      <Col background={'rgba(0,0,0,0.97)'} flex={1}>
        {}
        <Pressable
          onPress={onClose}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
>
          {uri ? (
            <Image src={uri} style={{ width: '100%', height: '100%' }} fit="contain"/>
          ) : null}
        </Pressable>

        {}
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 48, right: 20, padding: 10 }}
          hitSlop={10}
>
          <Icon name="x" size={28} color="#ffffff"/>
        </Pressable>

        {}
        <Box align="center" style={{ position: 'absolute', bottom: 48, left: 0, right: 0 }}>
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
              ? <Spinner size={20} color="#ffffff"/>
              : <Icon name="arrowDownTray" size={18} color="#ffffff" />}
            <Text weight="semibold" size="md" color={'#ffffff'}>
              {saving ? 'Saving…' : 'Download'}
            </Text>
          </Pressable>
        </Box>
      </Col>
    </Modal>
  );
}
