/** Voice-recording + slide-to-cancel gesture for the MessengerComposer,
 *  extracted for the lint line-budget. Behavior identical. Stages the recorded
 *  clip as a pending attachment via the passed `upload` callback. */

import { useMemo, useRef } from 'react';
import { Alert, Animated, PanResponder } from 'react-native';
import { Audio } from 'expo-av';

export interface VoiceArgs {
  upload: (uri: string, mime: string, name?: string) => Promise<void>;
  setErr: (v: string | null) => void;
  setRecording: (v: boolean) => void;
  setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  setLevels: React.Dispatch<React.SetStateAction<number[]>>;
}

/** Slide-to-cancel threshold — distance the mic has to travel left before a
 *  release cancels the recording instead of stopping+staging it. */
export const SLIDE_CANCEL_THRESHOLD_PX = 80;

export function useVoiceRecorder(args: VoiceArgs) {
  const { upload, setErr, setRecording, setRecordSecs, setLevels } = args;
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Mic press timestamp — distinguishes push-to-talk (hold) from a tap. */
  const micPressStart = useRef(0);
  /** Synchronous mirror of `recording` so push-to-talk release reliably stops. */
  const recordingRef = useRef(false);
  /** Animated value drives mic translateX + the "← slide to cancel" hint fade. */
  const slideX = useRef(new Animated.Value(0)).current;
  /** Synchronous mirror of the latest drag dx for onPanResponderRelease. */
  const slideXRef = useRef(0);
  /** If a stop/cancel arrives while startRec is still preparing, stash it. */
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
    await rec.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true });
    /** Feed mic metering (dBFS, ~-55 silent → 0 loud) into the waveform. */
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
    recTimerRef.current = setInterval(() => { setRecordSecs(s => s + 1); }, 1000);
    /** A release/cancel that landed mid-prepare — honour it now that we're live. */
    if (pendingStop.current === 'cancel') void cancelRec();
    else if (pendingStop.current === 'send') void stopRec();
  };

  /** Stop without staging (the ✕ / slide-left cancel). */
  const cancelRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'cancel'; setRecording(false); return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setLevels([]);
    try { await rec.stopAndUnloadAsync(); } catch { /* ignore */ }
  };

  /** Stop and stage the clip as a pending attachment (NOT auto-send). */
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

  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      micPressStart.current = Date.now();
      slideXRef.current = 0;
      slideX.setValue(0);
      if (recordingRef.current) { void stopRec(); return; }
      void startRec();
    },
    onPanResponderMove: (_, g) => {
      const dx = Math.max(-120, Math.min(0, g.dx));
      slideXRef.current = dx;
      slideX.setValue(dx);
    },
    onPanResponderRelease: () => {
      const dx = slideXRef.current;
      const held = Date.now() - micPressStart.current;
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
      if (!recordingRef.current) return;
      if (dx <= -SLIDE_CANCEL_THRESHOLD_PX) { void cancelRec(); return; }
      if (held >= 350) void stopRec();
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  return { slideX, micPanResponder, cancelRec, stopRec };
}
