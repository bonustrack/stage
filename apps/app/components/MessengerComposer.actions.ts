/** Composer action handlers (attachment staging, pickers, poll/signature/
 *  payment/send) extracted from MessengerComposer.tsx for the lint line-budget.
 *  Voice recording lives in MessengerComposer.voice.ts. Behavior is identical —
 *  this hook owns the imperative pieces and reads/writes parent state via setters. */

import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  fileUriToBase64, xmtpReply, xmtpSendAttachment, xmtpSendMultiRemoteAttachment, xmtpSendText,
} from '../lib/xmtp';
import { type Attachment, mimeOf, INLINE_ATTACHMENT_MAX_BYTES } from './MessengerComposer.helpers';
import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './MessengerComposer.voice';
import { sendPoll, sendSignatureRequest, sendTxRequest } from './MessengerComposer.builders';

interface OptimisticEntry { localId: string; text: string; attachments: Attachment[]; replyTo?: string; payload?: unknown }

export interface ComposerActionsArgs {
  xmtpLine: string;
  text: string;
  pending: Attachment[];
  replyingTo?: { id: string };
  mentionCandidates?: { address: string }[];
  setPending: React.Dispatch<React.SetStateAction<Attachment[]>>;
  setText: (v: string) => void;
  setSending: (v: boolean) => void;
  setUploading: (v: boolean) => void;
  setErr: (v: string | null) => void;
  setRecording: (v: boolean) => void;
  setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  setLevels: React.Dispatch<React.SetStateAction<number[]>>;
  setPollOpen: (v: boolean) => void;
  pollQuestion: string; pollHeader: string; pollOptions: string[]; pollMulti: boolean;
  setPollQuestion: (v: string) => void; setPollHeader: (v: string) => void;
  setPollOptions: (v: string[]) => void; setPollMulti: (v: boolean) => void;
  setSigOpen: (v: boolean) => void;
  sigKind: 'personal' | 'eip712'; sigDesc: string; sigMessage: string; sigJson: string;
  setSigKind: (v: 'personal' | 'eip712') => void; setSigDesc: (v: string) => void;
  setSigMessage: (v: string) => void; setSigJson: (v: string) => void;
  setTxOpen: (v: boolean) => void;
  txTo: string; txAmount: string; txNote: string;
  setTxTo: (v: string) => void; setTxAmount: (v: string) => void; setTxNote: (v: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
  onClearReply?: () => void;
}

const mintLocalId = (): string => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
    for (const asset of r.assets) {
      const fallbackMime = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      await upload(asset.uri, asset.mimeType ?? fallbackMime, asset.fileName ?? undefined);
    }
  };

  const pickFile = async (): Promise<void> => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    const asset = r.assets[0];
    await upload(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
  };

  /** Share current location as a Google Maps URL text message. */
  const pickLocation = async (): Promise<void> => {
    a.setErr(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { Alert.alert('Location permission denied'); return; }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
      await xmtpSendText(a.xmtpLine, `📍 ${url}`);
    } catch (e) { a.setErr((e as Error).message); }
  };

  /** Prefill the recipient with the lone DM peer when opening the sheet. */
  const openTx = (): void => {
    if (!a.txTo && a.mentionCandidates?.length === 1) a.setTxTo(a.mentionCandidates[0]!.address);
    a.setTxOpen(true);
  };

  const send = async (): Promise<void> => {
    const body = a.text.trim();
    if (!body && a.pending.length === 0) return;
    const localId = mintLocalId();
    const sendingAttachments = a.pending;
    const sendingReplyTo = a.replyingTo?.id;
    a.onOptimistic?.({ localId, text: body, attachments: sendingAttachments, replyTo: sendingReplyTo });
    a.setText(''); a.setPending([]); a.onClearReply?.();
    a.setSending(true); a.setErr(null);
    let sendErr: string | undefined;
    let sentId: string | undefined;
    try {
      if (body) {
        if (sendingReplyTo) sentId = await xmtpReply(a.xmtpLine, sendingReplyTo, body);
        else sentId = await xmtpSendText(a.xmtpLine, body);
      }
      const multiAtts = sendingAttachments.filter((at) => at.kind !== 'audio');
      const audioAtts = sendingAttachments.filter((at) => at.kind === 'audio');
      if (multiAtts.length > 0) {
        const multiId = await xmtpSendMultiRemoteAttachment(
          a.xmtpLine,
          multiAtts.map((at) => ({
            fileUri: at.url,
            mimeType: mimeOf(at.mime, at.name ?? at.url),
            filename: at.name ?? at.id,
          })),
        );
        if (!sentId) sentId = multiId;
      }
      for (const at of audioAtts) {
        const mimeType = mimeOf(at.mime, at.name ?? at.url);
        const filename = at.name ?? at.id;
        const dataB64 = await fileUriToBase64(at.url);
        const padding = dataB64.endsWith('==') ? 2 : dataB64.endsWith('=') ? 1 : 0;
        const byteLen = Math.floor((dataB64.length * 3) / 4) - padding;
        if (byteLen > INLINE_ATTACHMENT_MAX_BYTES) {
          throw new Error(
            `"${filename}" is too large to send (${(byteLen / (1024 * 1024)).toFixed(1)} MB). `
            + `Attachments must be under ${Math.round(INLINE_ATTACHMENT_MAX_BYTES / 1024)} KB.`,
          );
        }
        const attId = await xmtpSendAttachment(a.xmtpLine, filename, mimeType, dataB64);
        if (!sentId) sentId = attId;
      }
    } catch (e) { sendErr = (e as Error).message; a.setErr(sendErr); }
    finally {
      a.setSending(false);
      a.onSent?.(localId, sendErr, sentId);
    }
  };

  return {
    slideX: voice.slideX, micPanResponder: voice.micPanResponder, SLIDE_CANCEL_THRESHOLD_PX,
    cancelRec: voice.cancelRec, stopRec: voice.stopRec,
    pickImage, pickFile, pickLocation,
    sendPoll: () => sendPoll(a),
    sendSignatureRequest: () => sendSignatureRequest(a),
    sendTxRequest: () => sendTxRequest(a),
    openTx, send,
  };
}
