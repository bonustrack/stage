/** Composer action handlers (attachment staging, pickers, poll/signature/
 *  payment/send) extracted from MessengerComposer.tsx for the lint line-budget.
 *  Voice recording lives in MessengerComposer.voice.ts. Behavior is identical —
 *  this hook owns the imperative pieces and reads/writes parent state via setters. */

import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { xmtpSendText } from '../modules/messaging';
import { setLastAttachment } from '../lib/lastAttachment';
import { mimeOf } from './MessengerComposer.helpers';
import { rememberLocalAttachments, stashLocalAttachment } from '../lib/localAttachmentCache';
import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './MessengerComposer.voice';
import { sendPoll, sendSignatureRequest, sendTxRequest } from './MessengerComposer.builders';
import { planSendSteps } from './MessengerComposer.send';
import type { ComposerActionsArgs } from './MessengerComposer.types';

export type { ComposerActionsArgs } from './MessengerComposer.types';

/** Hook providing the composer's imperative action handlers (attachments, pickers, poll/signature/payment, send). */
export function useComposerActions(a: ComposerActionsArgs) {
  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    a.setUploading(true);
    try {
      const resolvedMime = mimeOf(mime, name ?? uri);
      const kind = resolvedMime.startsWith('image/') ? 'image'
        : resolvedMime.startsWith('audio/') ? 'audio'
          : resolvedMime.startsWith('video/') ? 'video' : 'file';
      /** Size is cosmetic (chip metadata only — no cap); read best-effort. */
      let size = 0;
      try { size = (await (await fetch(uri)).blob()).size; } catch { /* size is cosmetic */ }
      const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      a.setPending(prev => [...prev, { id, url: uri, kind, mime: resolvedMime, size, name }]);
    } catch (e) { a.setErr((e as Error).message); }
    finally { a.setUploading(false); }
  };

  const voice = useVoiceRecorder({
    upload, setErr: a.setErr, setRecording: a.setRecording,
    setRecordSecs: a.setRecordSecs, setLevels: a.setLevels,
  });

  const pickImage = async (): Promise<void> => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 10,
    });
    if (r.canceled || !r.assets?.length) return;
    setLastAttachment('Image');
    for (const asset of r.assets) {
      const fallbackMime = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      await upload(asset.uri, asset.mimeType ?? fallbackMime, asset.fileName ?? undefined);
    }
  };

  /** Take a photo with the device camera and stage it via the same pipeline. */
  const takePhoto = async (): Promise<void> => {
    a.setErr(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera permission denied'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    const asset = r.canceled ? undefined : r.assets[0];
    if (asset === undefined) return;
    setLastAttachment('Camera');
    await upload(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? undefined);
  };

  const pickFile = async (): Promise<void> => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    const asset = r.assets[0];
    if (asset === undefined) return;
    setLastAttachment('File');
    await upload(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
  };

  /** Share current location as an OpenStreetMap URL text message. Privacy-minded
   *  default: OSM doesn't profile the recipient the way a maps.google.com link
   *  does on tap / link-preview probe. */
  const pickLocation = async (): Promise<void> => {
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
  };

  /** Prefill the recipient with the lone DM peer when opening the sheet. */
  const openTx = (): void => {
    const lone = a.mentionCandidates?.length === 1 ? a.mentionCandidates[0] : undefined;
    if (!a.txTo && lone !== undefined) a.setTxTo(lone.address);
    a.setTxOpen(true);
  };

  const send = async (): Promise<void> => {
    const body = a.text.trim();
    if (!body && a.pending.length === 0) return;
    /** Snapshot the raw input so a failed send can restore it (see the catch
     *  below). We clear the composer optimistically before any await, so without
     *  this the message bytes would be gone if the network send throws. */
    const originalText = a.text;
    const originalPending = a.pending;
    /** Copy each picked local image/video/file into a STABLE app-cache path up
     *  front (synchronous, cheap on-disk copy). The picker's temp URI can be
     *  evicted while the send is in flight, which would blank the dimmed pending
     *  thumbnail; the stable path is pinned for the app session. Both the
     *  optimistic bubble AND the post-confirm `RemoteAttachmentResolver` then
     *  source these exact bytes, so the local image stays painted (no reload,
     *  no blank frame) across the optimistic→echo handoff. Audio rides a
     *  separate inline path and isn't displayed as a thumbnail, so leave it. */
    const sendingAttachments = a.pending.map((at) =>
      at.kind === 'audio' ? at : { ...at, url: stashLocalAttachment(at.url) });
    const sendingReplyTo = a.replyingTo?.id;
    /** Split this submission into the SEPARATE XMTP messages it produces (text,
     *  then the bundled attachment message, then each audio clip) so the
     *  optimistic preview mirrors the final bubbles 1:1 — same count + order,
     *  each confirmed independently by its own real id. The attachment step,
     *  once sent, maps its real msg id → local URIs so the live bubble paints
     *  the stashed bytes instantly (no download gap) across the echo handoff. */
    const steps = planSendSteps(a.xmtpLine, body, sendingAttachments, sendingReplyTo);

    /** Emit each optimistic entry up-front, in send order — only the first
     *  carries the replyTo so the quoted preview attaches to the text bubble. */
    steps.forEach((s, i) => a.onOptimistic?.({
      localId: s.localId, text: s.text, attachments: s.attachments,
      replyTo: i === 0 ? sendingReplyTo : undefined,
    }));
    a.setText(''); a.setPending([]); a.onClearReply?.();
    a.setSending(true); a.setErr(null);

    /** Send sequentially (preserves on-wire order = display order). Confirm each
     *  entry by its own real id; on failure, drop the remaining unsent entries.
     *  The whole loop is wrapped in try/finally so `sending` is ALWAYS reset -
     *  if any callback (onOptimistic/onSent/remember…) throws, the button would
     *  otherwise stay disabled forever and wedge the composer. */
    let sendErr: string | undefined;
    try {
      for (const s of steps) {
        if (sendErr) { a.onSent?.(s.localId, sendErr); continue; }
        try {
          const id = await s.run();
          /** Map the real msg id → the step's local image/video/file URIs so the
           *  live bubble paints the stashed bytes instantly when the optimistic
           *  entry is replaced by the still-downloading remote attachment. Audio
           *  rides an inline path with no thumbnail, so skip it. */
          const localUris = s.attachments.filter((at) => at.kind !== 'audio').map((at) => at.url);
          if (localUris.length > 0) rememberLocalAttachments(id, localUris);
          a.onSent?.(s.localId, undefined, id);
        } catch (e) {
          sendErr = (e as Error).message;
          a.setErr(sendErr);
          a.onSent?.(s.localId, sendErr);
        }
      }
    } finally {
      a.setSending(false);
    }
    /** Send failed: the optimistic bubble is dropped downstream, so put the
     *  original text + attachments back in the composer (only if the user hasn't
     *  already typed something new) so the message isn't silently lost. The send
     *  button reappears (content present) and the user can retry. */
    if (sendErr && a.text.trim().length === 0 && a.pending.length === 0) {
      a.setText(originalText);
      a.setPending(originalPending);
    }
  };

  return {
    slideX: voice.slideX, micPanResponder: voice.micPanResponder, SLIDE_CANCEL_THRESHOLD_PX,
    cancelRec: voice.cancelRec, stopRec: voice.stopRec,
    pickImage, takePhoto, pickFile, pickLocation,
    sendPoll: () => sendPoll(a),
    sendSignatureRequest: () => sendSignatureRequest(a),
    sendTxRequest: () => sendTxRequest(a),
    openTx, send,
  };
}
