export type DictationPhase = 'idle' | 'preparing' | 'downloading' | 'listening' | 'finishing';
export interface DictationDraft { text: string; selection: { start: number; end: number } }

export function dictationDraft(draft: DictationDraft, transcript: string): DictationDraft {
  if (!transcript) return draft;
  const start = Math.max(0, Math.min(draft.selection.start, draft.text.length));
  const end = Math.max(start, Math.min(draft.selection.end, draft.text.length));
  const before = draft.text.slice(0, start);
  const after = draft.text.slice(end);
  const leading = before && !/\s$/u.test(before) && !/^\s/u.test(transcript) ? ' ' : '';
  const trailing = after && !/^\s|^[.,!?;:]/u.test(after) && !/\s$/u.test(transcript) ? ' ' : '';
  const caret = before.length + leading.length + transcript.length;
  return { text: before + leading + transcript + trailing + after, selection: { start: caret, end: caret } };
}

export function dictationLabel(phase: DictationPhase): string {
  switch (phase) {
    case 'preparing': return 'Preparing on-device dictation…';
    case 'downloading': return 'Downloading speech language model…';
    case 'listening': return 'Listening on device. Tap the mic to stop.';
    case 'finishing': return 'Finishing dictation…';
    case 'idle': return '';
  }
}
