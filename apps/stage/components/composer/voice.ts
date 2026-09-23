import { useRef } from 'react';
import { Alert } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
} from 'expo-audio';
import { ignored } from '../../lib/errorPolicy';

export { SLIDE_CANCEL_THRESHOLD_PX } from '@stage-labs/kit/react-native/voice-recorder';

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const METERING_INTERVAL_MS = 80;

interface VoiceArgs {
  upload: (uri: string, mime: string, name?: string) => Promise<void>;
  setErr: (v: string | null) => void;
  setRecording: (v: boolean) => void;
  setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  setLevels: React.Dispatch<React.SetStateAction<number[]>>;
}

export function useVoiceRecorder(args: VoiceArgs) {
  const { upload, setErr, setRecording, setRecordSecs, setLevels } = args;
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recRef = useRef<AudioRecorder | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const meterTimerRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const pendingStop = useRef<null | 'send' | 'cancel'>(null);

  const clearTimers = (): void => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (meterTimerRef.current) { clearInterval(meterTimerRef.current); meterTimerRef.current = null; }
  };

  const sampleLevel = (rec: AudioRecorder): void => {
    const s = rec.getStatus();
    if (!s.isRecording || typeof s.metering !== 'number') return;
    const level = Math.max(0.05, Math.min(1, (s.metering + 55) / 55));
    setLevels(prev => [...prev, level].slice(-40));
  };

  const startRec = async (): Promise<void> => {
    if (recordingRef.current) return;
    setErr(null);
    recordingRef.current = true;
    pendingStop.current = null;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { recordingRef.current = false; Alert.alert('Mic permission denied'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    setLevels([]);
    recorder.record();
    recRef.current = recorder;
    setRecording(true);
    setRecordSecs(0);
    recTimerRef.current = setInterval(() => { setRecordSecs(s => s + 1); }, 1000) as unknown as number;
    meterTimerRef.current = setInterval(() => { sampleLevel(recorder); }, METERING_INTERVAL_MS) as unknown as number;
    if (pendingStop.current === 'cancel') void cancelRec();
    else if (pendingStop.current === 'send') void stopRec();
  };

  const cancelRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'cancel'; setRecording(false); return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    clearTimers();
    setLevels([]);
    await rec.stop().catch(ignored(undefined, 'cleanup'));
  };

  const stopRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'send'; return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    clearTimers();
    setLevels([]);
    await rec.stop();
    const uri = rec.uri; if (!uri) return;
    await upload(uri, 'audio/m4a', `voice-${Date.now()}.m4a`);
  };

  return { startRec, cancelRec, stopRec };
}
