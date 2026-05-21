/** Browser MediaRecorder composable for voice-note capture. */

import { ref } from 'vue';

export interface UseRecorderHandle {
  recording: ReturnType<typeof ref<boolean>>;
  recordSecs: ReturnType<typeof ref<number>>;
  start: () => Promise<void>;
  stop: () => void;
}

export function useRecorder(onBlob: (blob: Blob) => void, onError: (msg: string) => void): UseRecorderHandle {
  const recording = ref(false);
  const recordSecs = ref(0);
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const start = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e): void => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = (): void => {
        stream.getTracks().forEach(t => t.stop());
        onBlob(new Blob(chunks, { type: recorder?.mimeType ?? 'audio/webm' }));
      };
      recorder.start();
      recording.value = true;
      recordSecs.value = 0;
      timer = setInterval(() => { recordSecs.value += 1; }, 1000);
    } catch (e) { onError((e as Error).message); }
  };

  const stop = (): void => {
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
    recording.value = false;
    if (timer) { clearInterval(timer); timer = null; }
  };

  return { recording, recordSecs, start, stop };
}
