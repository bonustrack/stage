
import { useEffect, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { FilePickerMediaType, FilePickerSource } from '../kit';

export interface PickedFile {
  uri: string;
  mime: string;
  name?: string;
  type?: 'image' | 'video';
}

export interface FilePickerProps {
  openNonce?: number;
  source?: FilePickerSource;
  mediaTypes?: FilePickerMediaType[];
  multiple?: boolean;
  selectionLimit?: number;
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  onPick?: (files: PickedFile[]) => void;
  onCancel?: () => void;
}

function toImageMediaTypes(types?: FilePickerMediaType[]): ImagePicker.ImagePickerOptions['mediaTypes'] {
  if (types === undefined || types.length === 0) return ['images'];
  return types;
}

function assetToFile(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const isVideo = asset.type === 'video';
  return {
    uri: asset.uri,
    mime: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
    name: asset.fileName ?? undefined,
    type: isVideo ? 'video' : 'image',
  };
}

async function runLibrary(props: FilePickerProps): Promise<void> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: toImageMediaTypes(props.mediaTypes),
    quality: props.quality,
    allowsMultipleSelection: props.multiple,
    selectionLimit: props.selectionLimit,
    allowsEditing: props.allowsEditing,
    aspect: props.aspect,
  });
  if (r.canceled || !r.assets?.length) { props.onCancel?.(); return; }
  props.onPick?.(r.assets.map(assetToFile));
}

async function runCamera(props: FilePickerProps): Promise<void> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { props.onCancel?.(); return; }
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: toImageMediaTypes(props.mediaTypes),
    quality: props.quality,
  });
  if (r.canceled || !r.assets?.length) { props.onCancel?.(); return; }
  props.onPick?.(r.assets.map(assetToFile));
}

async function runDocument(props: FilePickerProps): Promise<void> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled) { props.onCancel?.(); return; }
  const asset = r.assets[0];
  if (asset === undefined) { props.onCancel?.(); return; }
  props.onPick?.([{
    uri: asset.uri,
    mime: asset.mimeType ?? 'application/octet-stream',
    name: asset.name,
  }]);
}

function runPicker(props: FilePickerProps): void {
  const source = props.source ?? 'library';
  if (source === 'camera') void runCamera(props);
  else if (source === 'document') void runDocument(props);
  else void runLibrary(props);
}

export function FilePicker(props: FilePickerProps): null {
  const propsRef = useRef(props);
  propsRef.current = props;
  const last = useRef<number | undefined>(props.openNonce);
  const nonce = props.openNonce;
  useEffect(() => {
    if (nonce === undefined) return;
    if (nonce === last.current) return;
    last.current = nonce;
    runPicker(propsRef.current);
  }, [nonce]);
  return null;
}
