import { useRef, useState, type ComponentRef } from 'react';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { type Attachment } from './MessengerComposer.helpers';

export interface ComposerState {
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  pending: Attachment[]; setPending: React.Dispatch<React.SetStateAction<Attachment[]>>;
  setSending: (v: boolean) => void;
  uploading: boolean; setUploading: (v: boolean) => void;
  textareaH: number; setTextareaH: (h: number) => void;
  err: string | null; setErr: (v: string | null) => void;
  recording: boolean; setRecording: (v: boolean) => void;
  recordSecs: number; setRecordSecs: React.Dispatch<React.SetStateAction<number>>;
  levels: number[]; setLevels: React.Dispatch<React.SetStateAction<number[]>>;
  attachMenuOpen: boolean; setAttachMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pollOpen: boolean; setPollOpen: (v: boolean) => void;
  pollQuestion: string; setPollQuestion: (v: string) => void;
  pollHeader: string; setPollHeader: (v: string) => void;
  pollOptions: string[]; setPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
  pollMulti: boolean; setPollMulti: React.Dispatch<React.SetStateAction<boolean>>;
  sigOpen: boolean; setSigOpen: (v: boolean) => void;
  sigKind: 'personal' | 'eip712'; setSigKind: (v: 'personal' | 'eip712') => void;
  sigDesc: string; setSigDesc: (v: string) => void;
  sigMessage: string; setSigMessage: (v: string) => void;
  sigJson: string; setSigJson: (v: string) => void;
  txOpen: boolean; setTxOpen: (v: boolean) => void;
  txTo: string; setTxTo: (v: string) => void;
  txAmount: string; setTxAmount: (v: string) => void;
  txNote: string; setTxNote: (v: string) => void;
  inputRef: React.RefObject<ComponentRef<typeof Textarea> | null>;
}

export function useComposerState(): ComposerState {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [pending, setPending] = useState<Attachment[]>([]);
  const [, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [textareaH, setTextareaH] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollHeader, setPollHeader] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigKind, setSigKind] = useState<'personal' | 'eip712'>('personal');
  const [sigDesc, setSigDesc] = useState('');
  const [sigMessage, setSigMessage] = useState('');
  const [sigJson, setSigJson] = useState('');
  const [txOpen, setTxOpen] = useState(false);
  const [txTo, setTxTo] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const inputRef = useRef<ComponentRef<typeof Textarea>>(null);
  return {
    text, setText, selection, setSelection, pending, setPending, setSending,
    uploading, setUploading, textareaH, setTextareaH, err, setErr,
    recording, setRecording, recordSecs, setRecordSecs, levels, setLevels,
    attachMenuOpen, setAttachMenuOpen,
    pollOpen, setPollOpen, pollQuestion, setPollQuestion, pollHeader, setPollHeader,
    pollOptions, setPollOptions, pollMulti, setPollMulti,
    sigOpen, setSigOpen, sigKind, setSigKind, sigDesc, setSigDesc,
    sigMessage, setSigMessage, sigJson, setSigJson,
    txOpen, setTxOpen, txTo, setTxTo, txAmount, setTxAmount, txNote, setTxNote,
    inputRef,
  };
}
