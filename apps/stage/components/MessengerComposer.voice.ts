
import { useRef } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

export { SLIDE_CANCEL_THRESHOLD_PX } from '@stage-labs/kit/react-native/voice-recorder';

export interface VoiceArgs {
  upload: (uri: string, mime: string, name?: string) => Promise<void>;
  setErr: (v: string | null) => void;
  setRecording: (v: boolean) => void;
  setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  setLevels: React.Dispatch<React.SetStateAction<number[]>>;
}

export function useVoiceRecorder(args: VoiceArgs) {
  const { upload, setErr, setRecording, setRecordSecs, setLevels } = args;
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const pendingStop = useRef<null | 'send' | 'cancel'>(null);

  const startRec = async (): Promise<void> => {
    if (recordingRef.current) return;
    setErr(null);
    recordingRef.current = true;
    pendingStop.current = null;
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { recordingRef.current = false; Alert.alert('Mic permission denied'); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    const preset = Audio.RecordingOptionsPresets.HIGH_QUALITY;
    if (preset === undefined) { recordingRef.current = false; setErr('Recording unavailable'); return; }
    await rec.prepareToRecordAsync({ ...preset, isMeteringEnabled: true });
    rec.setProgressUpdateInterval(80);
    rec.setOnRecordingStatusUpdate((s) => {
      if (s.isRecording && typeof s.metering === 'number') {
        const level = Math.max(0.05, Math.min(1, (s.metering + 55) / 55));
        setLevels(prev => [...prev, level].slice(-40));
      }
    });
    setLevels([]);
    await rec.startAsync();
    recRef.current = rec;
    setRecording(true);
    setRecordSecs(0);
    recTimerRef.current = setInterval(() => { setRecordSecs(s => s + 1); }, 1000) as unknown as number;
    if (pendingStop.current === 'cancel') void cancelRec();
    else if (pendingStop.current === 'send') void stopRec();
  };

  const cancelRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'cancel'; setRecording(false); return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setLevels([]);
    try { await rec.stopAndUnloadAsync(); } catch { }
  };

  const stopRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'send'; return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setLevels([]);
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI(); if (!uri) return;
    await upload(uri, 'audio/m4a', `voice-${Date.now()}.m4a`);
  };

  return { startRec, cancelRec, stopRec };
}
