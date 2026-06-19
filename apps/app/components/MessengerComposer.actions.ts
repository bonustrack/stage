/**
 * @file useComposerActions hook: the MessengerComposer's imperative action handlers (attachment staging, pickers, poll/signature/payment, send).
 */

import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './MessengerComposer.voice';
import { sendPoll, sendSignatureRequest, sendTxRequest } from './MessengerComposer.builders';
import type { ComposerActionsArgs } from './MessengerComposer.types';
import {
  uploadAttachment, pickImage, takePhoto, pickFile, pickLocation, performSend,
} from './MessengerComposer.actions.helpers';

export type { ComposerActionsArgs } from './MessengerComposer.types';

/** Hook providing the composer's imperative action handlers (attachments, pickers, poll/signature/payment, send). */
export function useComposerActions(a: ComposerActionsArgs) {
  /** Upload helper. */
  const upload = (uri: string, mime: string, name?: string): Promise<void> => uploadAttachment(a, uri, mime, name);

  const voice = useVoiceRecorder({
    upload, setErr: a.setErr, setRecording: a.setRecording,
    setRecordSecs: a.setRecordSecs, setLevels: a.setLevels,
  });

  /** Prefill the recipient with the lone DM peer when opening the sheet. */
  const openTx = (): void => {
    const lone = a.mentionCandidates?.length === 1 ? a.mentionCandidates[0] : undefined;
    if (!a.txTo && lone !== undefined) a.setTxTo(lone.address);
    a.setTxOpen(true);
  };

  return {
    slideX: voice.slideX, micPanResponder: voice.micPanResponder, SLIDE_CANCEL_THRESHOLD_PX,
    cancelRec: voice.cancelRec, stopRec: voice.stopRec,
    pickImage: () => pickImage(upload),
    takePhoto: () => takePhoto(a, upload),
    pickFile: () => pickFile(upload),
    pickLocation: () => pickLocation(a),
    sendPoll: () => sendPoll(a),
    sendSignatureRequest: () => sendSignatureRequest(a),
    sendTxRequest: () => sendTxRequest(a),
    openTx, send: () => performSend(a),
  };
}
