import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { capabilities } from '../../lib/capabilities';
import { callOwnsAudio, registerDictationRecorder, voiceOwnsAudio } from '../../lib/calls.audio.core';
import { report } from '../../lib/errorPolicy';
import { speech } from '../../lib/speech';
import { makeDictation } from './dictation.core';
import { makeDictationPress } from './dictation.press';
import type { DictationDraft, DictationPhase } from './dictation.model';

interface DictationArgs extends DictationDraft {
  key: string | null;
  recording: boolean;
  busy: boolean;
  setText(text: string): void;
  setSelection(selection: DictationDraft['selection']): void;
  setErr(message: string | null): void;
}

export function useDictation(args: DictationArgs) {
  const current = useRef(args);
  current.current = args;
  const focused = useRef(true);
  const control = useRef<ReturnType<typeof makeDictation> | null>(null);
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [press] = useState(() => makeDictationPress({
    start: () => { void control.current?.start(); },
    stop: () => { void control.current?.stop(); },
    toggle: () => { void control.current?.toggle(); },
  }));

  useEffect(() => {
    let mounted = true;
    const key = args.key;
    const instance = makeDictation(speech, {
      read: () => ({ text: current.current.text, selection: current.current.selection }),
      apply: draft => {
        current.current = { ...current.current, ...draft };
        current.current.setText(draft.text);
        current.current.setSelection(draft.selection);
      },
      phase: value => { if (mounted) setPhase(value); },
      error: message => { if (mounted) current.current.setErr(message); },
      microphoneGranted: async () => (await getRecordingPermissionsAsync()).granted,
      permission: async () => (await requestRecordingPermissionsAsync()).granted,
      confirmDownload: locale => capabilities.confirm({
        title: 'Download speech model?',
        message: `Download the ${locale} language model for on-device dictation. This uses the internet for the model only. Your microphone audio stays on this device.`,
        confirmLabel: 'Download',
      }),
      blocked: () => current.current.key !== key || !focused.current || AppState.currentState === 'background' || callOwnsAudio() || voiceOwnsAudio() || current.current.recording || current.current.busy,
      cleanupError: error => { report('dictation.cleanup', error); },
    });
    control.current = instance;
    setPhase('idle');
    const unregister = registerDictationRecorder(instance.cancel);
    const app = AppState.addEventListener('change', state => {
      if (state === 'background') instance.background();
      else if (state === 'inactive') instance.inactive();
    });
    return () => {
      mounted = false;
      press.reset();
      app.remove();
      void instance.dispose();
      void unregister().catch((error: unknown) => { report('dictation.dispose', error); });
      if (control.current === instance) control.current = null;
    };
  }, [args.key, press]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; void control.current?.cancel(); };
  }, []));
  useEffect(() => {
    control.current?.edited();
    if (args.recording || args.busy) void control.current?.cancel();
  }, [args.text, args.recording, args.busy]);

  return {
    phase,
    press,
    recordVoice: (action: () => Promise<void>) => control.current?.recordVoice(action) ?? Promise.resolve(),
    setText: (text: string) => {
      void control.current?.cancel();
      current.current = { ...current.current, text };
      args.setText(text);
    },
  };
}
