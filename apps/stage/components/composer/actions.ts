import { useState } from 'react';
import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './voice';
import type { ComposerState } from './state';
import type { PostHooks } from './types';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { xmtpSendText } from '../../modules/messaging';
import { setLastAttachment } from '../../lib/lastAttachment';
import { mimeOf } from '../../lib/attachmentFiles';
import { rememberLocalAttachments, stashLocalAttachment } from '../../lib/localAttachmentCache';
import { planSendSteps, type SendStep } from './send';
import { ignored } from '../../lib/errorPolicy';

type ComposerActionsArgs = PostHooks & Pick<ComposerState,
  'text' | 'pending' | 'setPending' | 'setText' | 'setUploading' | 'setRecording' | 'setRecordSecs' | 'setLevels'
> & {
  replyingTo?: { id: string };
  onClearReply?: () => void;
};

function kindOf(mime: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

async function uploadAttachment(a: ComposerActionsArgs, uri: string, mime: string, name?: string): Promise<void> {
  a.setUploading(true);
  try {
    const resolvedMime = mimeOf(mime, name ?? uri);
    const kind = kindOf(resolvedMime);
    const size = await fetch(uri).then(r => r.blob()).then(b => b.size).catch(ignored(0, 'optional'));
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    a.setPending(prev => [...prev, { id, url: uri, kind, mime: resolvedMime, size, name }]);
  } catch (e) { a.setErr((e as Error).message); }
  finally { a.setUploading(false); }
}

type Upload = (uri: string, mime: string, name?: string) => Promise<void>;

interface ComposerPickedFile { uri: string; mime: string; name?: string; type?: 'image' | 'video' }

async function onPickedImages(upload: Upload, files: ComposerPickedFile[]): Promise<void> {
  if (files.length === 0) return;
  setLastAttachment('Image');
  for (const file of files) {
    await upload(file.uri, file.mime, file.name);
  }
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
    const { latitude: lat, longitude: lng } = pos.coords;
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
    await xmtpSendText(a.xmtpLine, `📍 ${url}`);
    setLastAttachment('Location');
  } catch (e) { a.setErr((e as Error).message); }
}

async function runStep(a: ComposerActionsArgs, s: SendStep): Promise<string | undefined> {
  try {
    const id = await s.run();
    const localUris = s.attachments.filter((at) => at.kind !== 'audio').map((at) => at.url);
    if (localUris.length > 0) rememberLocalAttachments(id, localUris);
    a.onSent?.(s.localId, undefined, id);
    return undefined;
  } catch (e) {
    const msg = (e as Error).message;
    a.setErr(msg);
    a.onSent?.(s.localId, msg);
    return msg;
  }
}

async function runSendSteps(a: ComposerActionsArgs, steps: SendStep[]): Promise<string | undefined> {
  let sendErr: string | undefined;
  for (const s of steps) {
    if (sendErr) { a.onSent?.(s.localId, sendErr); continue; }
    sendErr = await runStep(a, s);
  }
  return sendErr;
}

function beginSend(a: ComposerActionsArgs, body: string): SendStep[] {
  const sendingAttachments = a.pending.map((at) =>
    at.kind === 'audio' ? at : { ...at, url: stashLocalAttachment(at.url) });
  const sendingReplyTo = a.replyingTo?.id;
  const steps = planSendSteps(a.xmtpLine, body, sendingAttachments, sendingReplyTo);
  steps.forEach((s, i) => a.onOptimistic?.({
    localId: s.localId, text: s.text, attachments: s.attachments,
    replyTo: i === 0 ? sendingReplyTo : undefined,
  }));
  a.setText(''); a.setPending([]); a.onClearReply?.();
  a.setErr(null);
  return steps;
}

async function performSend(a: ComposerActionsArgs): Promise<void> {
  const body = a.text.trim();
  if (!body && a.pending.length === 0) return;
  const originalText = a.text;
  const originalPending = a.pending;
  const steps = beginSend(a, body);
  const sendErr = await runSendSteps(a, steps);
  if (sendErr && a.text.trim().length === 0 && a.pending.length === 0) {
    a.setText(originalText);
    a.setPending(originalPending);
  }
}

export function useComposerActions(a: ComposerActionsArgs) {
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
    pickImage: () => { setImageNonce(n => n + 1); },
    takePhoto: () => { void takePhoto(); },
    pickFile: () => { setFileNonce(n => n + 1); },
    pickLocation: () => pickLocation(a),
    imageNonce, cameraNonce, fileNonce,
    onPickedImages: (files: ComposerPickedFile[]) => onPickedImages(upload, files),
    onPickedCamera: (files: ComposerPickedFile[]) => onPickedCamera(upload, files),
    onPickedFile: (files: ComposerPickedFile[]) => onPickedFile(upload, files),
    send: () => performSend(a),
  };
}
