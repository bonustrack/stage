import { useEffect, useRef } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { describeError, report } from '../../lib/errorPolicy';
import { makeVoiceRecorder } from './voice.core';
import { recordedVoiceFile } from './voiceFile';
import { acquireVoiceAudio, callOwnsAudio, registerCallRecorder, releaseVoiceAudio } from '../../lib/calls.audio.core';

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
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const argsRef = useRef(args);
  argsRef.current = args;
  const controlRef = useRef<ReturnType<typeof makeVoiceRecorder> | null>(null);
  const startingRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let mounted = true;
    let secondsTimer: ReturnType<typeof setInterval> | undefined;
    let meterTimer: ReturnType<typeof setInterval> | undefined;
    const clearTimers = (): void => { clearInterval(secondsTimer); clearInterval(meterTimer); };
    const control = makeVoiceRecorder({
      prepare: async () => {
        await acquireVoiceAudio(recorder);
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error('Microphone permission denied. Allow microphone access, then try again.');
        if (callOwnsAudio()) throw new Error('Leave the call before recording a voice message.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (callOwnsAudio()) throw new Error('Leave the call before recording a voice message.');
        await recorder.prepareToRecordAsync();
        if (callOwnsAudio()) throw new Error('Leave the call before recording a voice message.');
      },
      record: () => { recorder.record(); },
      stop: () => recorder.stop(),
      file: async () => {
        if (!recorder.uri) throw new Error('The voice recorder did not create an audio file.');
        return recordedVoiceFile(recorder.uri);
      },
    }, {
      begin: () => { argsRef.current.setErr(null); },
      started: () => {
        if (!mounted) return;
        const a = argsRef.current;
        a.setLevels([]); a.setRecordSecs(0); a.setRecording(true);
        secondsTimer = setInterval(() => { argsRef.current.setRecordSecs(seconds => seconds + 1); }, 1000);
        meterTimer = setInterval(() => {
          const status = recorder.getStatus();
          if (!status.isRecording || typeof status.metering !== 'number') return;
          const level = Math.max(0.05, Math.min(1, (status.metering + 55) / 55));
          argsRef.current.setLevels(levels => [...levels, level].slice(-40));
        }, METERING_INTERVAL_MS);
      },
      stopped: () => {
        releaseVoiceAudio(recorder);
        clearTimers();
        if (mounted) { argsRef.current.setRecording(false); argsRef.current.setLevels([]); }
      },
      error: error => {
        report('voice.recording', error);
        if (mounted) argsRef.current.setErr(describeError(error));
      },
      upload: file => argsRef.current.upload(file.uri, file.mime, `voice-${Date.now()}.${file.extension}`),
    });
    controlRef.current = control;
    const unregister = registerCallRecorder(async () => { await control.cancel(); await startingRef.current; });
    return () => { mounted = false; clearTimers(); unregister(); void control.dispose(); };
  }, [recorder]);

  return {
    startRec: () => {
      if (startingRef.current) return startingRef.current;
      const starting = (controlRef.current?.start() ?? Promise.resolve()).finally(() => {
        if (startingRef.current === starting) startingRef.current = null;
      });
      startingRef.current = starting;
      return starting;
    },
    cancelRec: () => controlRef.current?.cancel() ?? Promise.resolve(),
    stopRec: () => controlRef.current?.stop() ?? Promise.resolve(),
  };
}
