import { useRef, useState } from 'react';
import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './voice';
import type { ComposerState } from './state';
import type { PostHooks } from './types';
import { Alert, Platform } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { setLastAttachment } from '../../lib/lastAttachment';
import { mimeOf } from '../../lib/attachmentFiles';
import { stashLocalAttachment } from '../../lib/localAttachmentCache';
import { fileInputs } from './send.model';
import { prepareAttachments } from '../../modules/messaging';
import { finishSend, showSend, startSend, type DraftArgs, type StartedSend } from './sendRun';
import { locationAttachment, withLocation } from './location.model';
import { ignored } from '../../lib/errorPolicy';

type ComposerActionsArgs = DraftArgs & PostHooks
  & Pick<ComposerState, 'setUploading' | 'setRecording' | 'setRecordSecs' | 'setLevels'>;

function kindOf(mime: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

const mintAttachmentId = (): string => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function uploadAttachment(a: ComposerActionsArgs, uri: string, mime: string, name?: string): Promise<void> {
  a.setUploading(true);
  try {
    const resolvedMime = mimeOf(mime, name ?? uri);
    const kind = kindOf(resolvedMime);
    const size = await fetch(uri).then(r => r.blob()).then(b => b.size).catch(ignored(0, 'optional'));
    const attachment = { id: mintAttachmentId(), url: stashLocalAttachment(uri), kind, mime: resolvedMime, size, name };
    a.setPending(prev => [...prev, attachment]);
    prepareAttachments(fileInputs([attachment]));
  } catch (e) { a.setErr((e as Error).message); }
  finally { a.setUploading(false); }
}

type Upload = (uri: string, mime: string, name?: string) => Promise<void>;

interface ComposerPickedFile { uri: string; mime: string; name?: string; type?: 'image' | 'video' }

async function uploadEach(upload: Upload, files: ComposerPickedFile[]): Promise<void> {
  for (const file of files) {
    await upload(file.uri, file.mime, file.name);
  }
}

async function onPickedImages(upload: Upload, files: ComposerPickedFile[]): Promise<void> {
  if (files.length === 0) return;
  setLastAttachment('Image');
  await uploadEach(upload, files);
}

async function requestCameraPermission(a: ComposerActionsArgs): Promise<boolean> {
  a.setErr(null);
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert('Camera permission denied'); return false; }
  return true;
}

async function onPickedCamera(upload: Upload, files: ComposerPickedFile[]): Promise<void> {
  const file = files[0];
  if (file === undefined) return;
  setLastAttachment('Camera');
  await upload(file.uri, file.mime, file.name);
}

async function onPickedFile(upload: Upload, files: ComposerPickedFile[]): Promise<void> {
  const file = files[0];
  if (file === undefined) return;
  setLastAttachment('File');
  await upload(file.uri, file.mime, file.name);
}

async function pickLocation(a: ComposerActionsArgs): Promise<void> {
  a.setErr(null);
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) { Alert.alert('Location permission denied'); return; }
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const location = locationAttachment(pos.coords.latitude, pos.coords.longitude, mintAttachmentId());
    a.setPending(prev => withLocation(prev, location));
    setLastAttachment('Location');
  } catch (e) { a.setErr((e as Error).message); }
}

async function performSend(a: ComposerActionsArgs, current: () => ComposerActionsArgs): Promise<void> {
  if (!a.text.trim() && a.pending.length === 0) return;
  const line = await a.openLine();
  if (line === null) return;
  const started = startSend(line, a.text, a.pending, a.replyingTo?.id);
  showSend(a, started);
  await finishSend(a, started, current);
}

function adoptSend(a: ComposerActionsArgs, started: StartedSend, current: () => ComposerActionsArgs): Promise<void> {
  showSend(a, started);
  return finishSend(a, started, current);
}

const KEYBOARD_HIDE_WAIT_MS = 500;

function afterKeyboardHides(open: () => void): void {
  if (Platform.OS === 'web') { open(); return; }
  const waited = new Promise<void>(done => { setTimeout(done, KEYBOARD_HIDE_WAIT_MS); });
  void Promise.race([KeyboardController.dismiss(), waited]).then(open);
}

export function useComposerActions(a: ComposerActionsArgs) {
  const current = useRef(a);
  current.current = a;
  const upload = (uri: string, mime: string, name?: string): Promise<void> => uploadAttachment(a, uri, mime, name);
  const [imageNonce, setImageNonce] = useState(0);
  const [cameraNonce, setCameraNonce] = useState(0);
  const [fileNonce, setFileNonce] = useState(0);

  const takePhoto = async (): Promise<void> => {
    if (await requestCameraPermission(a)) setCameraNonce(n => n + 1);
  };

  const voice = useVoiceRecorder({
    upload, setErr: a.setErr, setRecording: a.setRecording,
    setRecordSecs: a.setRecordSecs, setLevels: a.setLevels,
  });

  return {
    SLIDE_CANCEL_THRESHOLD_PX,
    startRec: voice.startRec, cancelRec: voice.cancelRec, stopRec: voice.stopRec,
    pickImage: () => { afterKeyboardHides(() => { setImageNonce(n => n + 1); }); },
    takePhoto: () => { afterKeyboardHides(() => { void takePhoto(); }); },
    pickFile: () => { afterKeyboardHides(() => { setFileNonce(n => n + 1); }); },
    pickLocation: () => pickLocation(a),
    imageNonce, cameraNonce, fileNonce,
    onPickedImages: (files: ComposerPickedFile[]) => onPickedImages(upload, files),
    onPickedCamera: (files: ComposerPickedFile[]) => onPickedCamera(upload, files),
    onPickedFile: (files: ComposerPickedFile[]) => onPickedFile(upload, files),
    onDroppedFiles: (files: ComposerPickedFile[]) => uploadEach(upload, files),
    send: () => performSend(a, () => current.current),
    adoptSend: (started: StartedSend) => adoptSend(current.current, started, () => current.current),
  };
}
