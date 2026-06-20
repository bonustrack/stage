/** @file Pure helpers backing useComposerActions: attachment upload/pickers and the multi-step send pipeline. */
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { xmtpSendText } from '../modules/messaging';
import { setLastAttachment } from '../lib/lastAttachment';
import { mimeOf } from './MessengerComposer.helpers';
import { rememberLocalAttachments, stashLocalAttachment } from '../lib/localAttachmentCache';
import { planSendSteps, type SendStep } from './MessengerComposer.send';
import type { ComposerActionsArgs } from './MessengerComposer.types';

/** Map a resolved MIME type to the staged attachment kind. */
function kindOf(mime: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/** Stage a local attachment (resolve mime/kind, best-effort size, push to pending). */
export async function uploadAttachment(a: ComposerActionsArgs, uri: string, mime: string, name?: string): Promise<void> {
  a.setUploading(true);
  try {
    const resolvedMime = mimeOf(mime, name ?? uri);
    const kind = kindOf(resolvedMime);
    /** Size is cosmetic (chip metadata only — no cap); read best-effort. */
    let size = 0;
    try { size = (await (await fetch(uri)).blob()).size; } catch { /* size is cosmetic */ }
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    a.setPending(prev => [...prev, { id, url: uri, kind, mime: resolvedMime, size, name }]);
  } catch (e) { a.setErr((e as Error).message); }
  finally { a.setUploading(false); }
}

/** Upload helper signature shared by the picker handlers. */
type Upload = (uri: string, mime: string, name?: string) => Promise<void>;

/** Pick image(s)/video(s) from the library and stage each. */
export async function pickImage(upload: Upload): Promise<void> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 10,
  });
  if (r.canceled || !r.assets?.length) return;
  setLastAttachment('Image');
  for (const asset of r.assets) {
    const fallbackMime = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
    await upload(asset.uri, asset.mimeType ?? fallbackMime, asset.fileName ?? undefined);
  }
}

/** Take a photo with the device camera and stage it via the same pipeline. */
export async function takePhoto(a: ComposerActionsArgs, upload: Upload): Promise<void> {
  a.setErr(null);
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert('Camera permission denied'); return; }
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
  const asset = r.canceled ? undefined : r.assets[0];
  if (asset === undefined) return;
  setLastAttachment('Camera');
  await upload(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? undefined);
}

/** Pick a document from the file system and stage it. */
export async function pickFile(upload: Upload): Promise<void> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled) return;
  const asset = r.assets[0];
  if (asset === undefined) return;
  setLastAttachment('File');
  await upload(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
}

/** Share current location as an OpenStreetMap URL text message (privacy-minded default). */
export async function pickLocation(a: ComposerActionsArgs): Promise<void> {
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

/** Run one send step, mapping its real id → local URIs on success; returns the error message if it threw. */
async function runStep(a: ComposerActionsArgs, s: SendStep): Promise<string | undefined> {
  try {
    const id = await s.run();
    /** Map the real msg id → the step's local image/video/file URIs so the live bubble paints stashed bytes instantly (audio rides an inline path, skipped). */
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

/** Send every step sequentially (on-wire = display order); on failure, drop the remaining unsent entries. Returns the first error. */
async function runSendSteps(a: ComposerActionsArgs, steps: SendStep[]): Promise<string | undefined> {
  let sendErr: string | undefined;
  try {
    for (const s of steps) {
      if (sendErr) { a.onSent?.(s.localId, sendErr); continue; }
      sendErr = await runStep(a, s);
    }
  } finally {
    a.setSending(false);
  }
  return sendErr;
}

/** Build the send steps, emit optimistic previews, and clear the composer before any await. */
function beginSend(a: ComposerActionsArgs, body: string): SendStep[] {
  /** Copy each picked local image/video/file into a STABLE app-cache path up front since the picker's temp URI can be evicted mid-send (audio rides a separate inline path). */
  const sendingAttachments = a.pending.map((at) =>
    at.kind === 'audio' ? at : { ...at, url: stashLocalAttachment(at.url) });
  const sendingReplyTo = a.replyingTo?.id;
  /** Split this submission into the SEPARATE XMTP messages it produces so the optimistic preview mirrors the final bubbles 1:1. */
  const steps = planSendSteps(a.xmtpLine, body, sendingAttachments, sendingReplyTo);
  /** Emit each optimistic entry up-front, in send order — only the first carries replyTo. */
  steps.forEach((s, i) => a.onOptimistic?.({
    localId: s.localId, text: s.text, attachments: s.attachments,
    replyTo: i === 0 ? sendingReplyTo : undefined,
  }));
  a.setText(''); a.setPending([]); a.onClearReply?.();
  a.setSending(true); a.setErr(null);
  return steps;
}

/** Send the composer's current text + staged attachments as ordered XMTP messages, restoring input on failure. */
export async function performSend(a: ComposerActionsArgs): Promise<void> {
  const body = a.text.trim();
  if (!body && a.pending.length === 0) return;
  /** Snapshot the raw input so a failed send can restore it (we clear optimistically before any await). */
  const originalText = a.text;
  const originalPending = a.pending;
  const steps = beginSend(a, body);
  const sendErr = await runSendSteps(a, steps);
  /** Send failed: optimistic bubble is dropped downstream, so restore the original text + attachments (only if the user hasn't already typed something new). */
  if (sendErr && a.text.trim().length === 0 && a.pending.length === 0) {
    a.setText(originalText);
    a.setPending(originalPending);
  }
}
