
import { useState } from 'react';
import { useVoiceRecorder, SLIDE_CANCEL_THRESHOLD_PX } from './MessengerComposer.voice';
import { sendPoll, sendSignatureRequest, sendTxRequest } from './MessengerComposer.builders';
import type { ComposerActionsArgs } from './MessengerComposer.types';
import {
  uploadAttachment, pickLocation, performSend, requestCameraPermission,
  onPickedImages, onPickedCamera, onPickedFile, type ComposerPickedFile,
} from './MessengerComposer.actions.helpers';

export type { ComposerActionsArgs } from './MessengerComposer.types';

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

  const openTx = (): void => {
    const lone = a.mentionCandidates?.length === 1 ? a.mentionCandidates[0] : undefined;
    if (!a.txTo && lone !== undefined) a.setTxTo(lone.address);
    a.setTxOpen(true);
  };

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
    sendPoll: () => sendPoll(a),
    sendSignatureRequest: () => sendSignatureRequest(a),
    sendTxRequest: () => sendTxRequest(a),
    openTx, send: () => performSend(a),
  };
}
