import { useState } from 'react';
import { type Attachment } from './types';

export interface ComposerState {
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  pending: Attachment[]; setPending: React.Dispatch<React.SetStateAction<Attachment[]>>;
  uploading: boolean; setUploading: (v: boolean) => void;
  err: string | null; setErr: (v: string | null) => void;
  recording: boolean; setRecording: (v: boolean) => void;
  recordSecs: number; setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  levels: number[]; setLevels: React.Dispatch<React.SetStateAction<number[]>>;
  attachMenuOpen: boolean; setAttachMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pollOpen: boolean; setPollOpen: (v: boolean) => void;
  sigOpen: boolean; setSigOpen: (v: boolean) => void;
  txOpen: boolean; setTxOpen: (v: boolean) => void;
  focusNonce: number; bumpFocus: () => void;
  blurNonce: number; bumpBlur: () => void;
}

export function useComposerState(): ComposerState {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [pending, setPending] = useState<Attachment[]>([]);
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
