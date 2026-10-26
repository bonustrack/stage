import { useState } from 'react';
import { type Attachment } from './types';

export function useComposerState(initialPending: Attachment[] = []) {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [pending, setPending] = useState<Attachment[]>(initialPending);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [blurNonce, setBlurNonce] = useState(0);
  const bumpFocus = (): void => { setFocusNonce((n) => n + 1); };
  const bumpBlur = (): void => { setBlurNonce((n) => n + 1); };
  return {
    text, setText, selection, setSelection, pending, setPending,
    uploading, setUploading, err, setErr,
    recording, setRecording, recordSecs, setRecordSecs, levels, setLevels,
    attachMenuOpen, setAttachMenuOpen,
    pollOpen, setPollOpen, sigOpen, setSigOpen, txOpen, setTxOpen,
    focusNonce, bumpFocus, blurNonce, bumpBlur,
  };
}

export type ComposerState = ReturnType<typeof useComposerState>;
