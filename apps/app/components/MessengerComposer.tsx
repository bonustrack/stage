/** Floating two-line composer (Claude-mobile-style): textarea on top, [+ / mic / send] below. */

import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { ComposerGradient } from './ComposerGradient';
import { Col } from './layout';
import { type Attachment } from './MessengerComposer.helpers';
import { useComposerActions } from './MessengerComposer.actions';
import { useComposerDrafts, useComposerFocus, computeMentions, applyMention, useLastAttachment } from './MessengerComposer.hooks';
import { PollSheet, SignatureSheet, PaymentSheet } from './MessengerComposer.sheets';
import { ReplyBanner, MentionPopup, PendingRow } from './MessengerComposer.parts';
import { ComposerEditor, AttachMenu, buildAttachActions } from './MessengerComposer.editor';
import { DANGER, usePalette } from '../lib/theme';

interface Props {
  dark: boolean;
  /** Target XMTP conversation line URI (`metro://xmtp/<convId>`). Required — the
   *  mobile composer only supports the XMTP transport now (the daemon-routed
   *  messenger pipeline was removed). */
  xmtpLine: string;
  /** Candidates surfaced in the `@`-mention popup — channel members for
   *  groups, or contact list for DMs. Parent owns the source-of-truth list;
   *  composer just filters/renders. Empty array disables the popup. */
  mentionCandidates?: { address: string; name: string; cacheBuster?: number }[];
  /** `nonce` (optional) changes on every reply action — even re-replying to the
   *  same message — so the composer re-focuses + re-opens the keyboard each time. */
  replyingTo?: { id: string; preview: string; sender?: string | null; nonce?: number };
  /** Bump to focus the composer + raise the keyboard WITHOUT setting a reply
   *  target (e.g. opening a DM from the floating pill). Each new value re-fires
   *  the focus effect. */
  autoFocusNonce?: number;
  onClearReply?: () => void;
  /** Tap the reply banner → best-effort scroll the feed to the replied-to
   *  message (crash-safe; no-ops if the row isn't currently loaded). */
  onJumpToReply?: (messageId: string) => void;
  /** Optimistic-render hook: invoked the moment the user taps send, before the API call. */
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string; payload?: unknown }) => void;
  /** Fired AFTER the send completes (success OR failure). Lets the parent drop the
   *  optimistic entry instead of waiting for an SSE/stream echo that may never arrive
   *  (XMTP `streamMessages` doesn't always replay self-sends — pending bubbles would stick). */
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}

export function MessengerComposer({
  dark, xmtpLine, mentionCandidates, replyingTo, autoFocusNonce, onClearReply, onJumpToReply, onOptimistic, onSent,
}: Props): React.ReactElement {
  const pal = usePalette(); // text/primary/border/bg ← tokens
  const fg = pal.text, head = pal.link, inputBg = pal.inputBg, chipBg = pal.border;
  // `sub` = muted/secondary text (placeholder, timestamps). No `muted` token
  // exists yet, so map to `text` to keep it editable. TODO: dedicated muted token.
  const sub = pal.text;
  const palette = { fg, sub, inputBg, chipBg };

  const [text, setText] = useState('');
  /** Cursor position in `text`, kept in sync via onSelectionChange so the
   *  mention detector knows where the user is typing. */
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [pending, setPending] = useState<Attachment[]>([]);
  const [, setSending] = useState(false); // set by send loop; button hides on clear, not via disabled
  const [uploading, setUploading] = useState(false);
  /** Textarea content height — drives the scroll fades. */
  const [textareaH, setTextareaH] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  /** Rolling mic levels (0..1) for the recording waveform — newest at the end. */
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
  /** Composer text input — focused programmatically when a reply target is set. */
  const inputRef = useRef<TextInput>(null);

  const actions = useComposerActions({
    xmtpLine, text, pending, replyingTo, mentionCandidates,
    setPending, setText, setSending, setUploading, setErr,
    setRecording, setRecordSecs, setLevels,
    setPollOpen, pollQuestion, pollHeader, pollOptions, pollMulti,
    setPollQuestion, setPollHeader, setPollOptions, setPollMulti,
    setSigOpen, sigKind, sigDesc, sigMessage, sigJson,
    setSigKind, setSigDesc, setSigMessage, setSigJson,
    setTxOpen, txTo, txAmount, txNote, setTxTo, setTxAmount, setTxNote,
    onOptimistic, onSent, onClearReply,
  });
  const { slideX, micPanResponder, SLIDE_CANCEL_THRESHOLD_PX } = actions;

  const convId = xmtpLine.replace('metro://xmtp/', '');
  useComposerDrafts(convId, text, setText);
  useComposerFocus(inputRef, replyingTo?.id, replyingTo?.nonce, autoFocusNonce);

  const hasContent = text.trim().length > 0 || pending.length > 0; // text or any pending attachment

  const { matches: mentionMatches, range: mentionRange } = computeMentions(text, selection.start, mentionCandidates);
  const pickMention = (c: { address: string; name: string }): void => {
    if (!mentionRange) return;
    const { next, cursor } = applyMention(text, mentionRange, c.address);
    setText(next);
    setSelection({ start: cursor, end: cursor });
  };

  const attachActions = buildAttachActions({
    pickImage: actions.pickImage, takePhoto: actions.takePhoto,
    pickFile: actions.pickFile, pickLocation: actions.pickLocation,
    openPoll: () => setPollOpen(true), openSig: () => setSigOpen(true), openTx: () => actions.openTx(),
  });
  /** Last-used type's icon → quick-access button left of "+"; hidden until first use. */
  const lastLabel = useLastAttachment();
  const quick = attachActions.find(([, label]) => label === lastLabel);

  const bg = pal.bg; // #0e0f10 / #ffffff
  return (
    <Col px={0} pt={0} pb={0} bg={bg}>
      {/** 24px fade sits directly above the composer; bleeds full-width to the
       *   screen edges (composer is edge-to-edge, no horizontal inset). */}
      <ComposerGradient bg={bg} direction="down" top={-24} height={24} left={0} right={0} />
      {replyingTo ? (
        <ReplyBanner
          dark={dark} sub={sub} sender={replyingTo.sender} onClear={onClearReply}
          onPress={onJumpToReply ? () => onJumpToReply(replyingTo.id) : undefined}
        />
      ) : null}
      {/** @-mention popup — Discord-style, stacked above the composer. */}
      {mentionRange && mentionMatches.length > 0 ? (
        <MentionPopup dark={dark} head={head} sub={sub} matches={mentionMatches} onPick={pickMention} />
      ) : null}
      {pending.length > 0 ? (
        <PendingRow
          fg={fg} sub={sub} chipBg={chipBg} pending={pending}
          onRemove={(i) => setPending(prev => prev.filter((_, j) => j !== i))}
        />
      ) : null}
      {uploading || err ? (
        <Text style={{ color: err ? DANGER : sub, fontSize: 12, paddingHorizontal: 14, paddingBottom: 4 }}>
          {err ?? 'Uploading…'}
        </Text>
      ) : null}
      <ComposerEditor
        dark={dark} fg={fg} head={head} bg={bg} sub={sub} inputBg={inputBg} chipBg={chipBg}
        recording={recording} levels={levels} recordSecs={recordSecs}
        slideX={slideX} slideThresholdPx={SLIDE_CANCEL_THRESHOLD_PX} micPanResponder={micPanResponder}
        text={text} setText={setText}
        selection={selection} setSelection={setSelection}
        textareaH={textareaH} setTextareaH={setTextareaH}
        inputRef={inputRef}
        attachMenuOpen={attachMenuOpen} setAttachMenuOpen={setAttachMenuOpen}
        quickIcon={quick?.[0]}
        onQuick={quick ? () => void quick[2]() : undefined}
        hasContent={hasContent}
        onCancelRec={() => void actions.cancelRec()}
        onStopRec={() => void actions.stopRec()}
        onSend={() => void actions.send()}
      />
      {/** Attach menu — horizontally-scrollable row of circular icon+label buttons. */}
      {attachMenuOpen ? (
        <AttachMenu
          head={head} inputBg={inputBg} chipBg={chipBg}
          onClose={() => setAttachMenuOpen(() => false)}
          actions={attachActions}
        />
      ) : null}
      <PollSheet
        open={pollOpen} onClose={() => setPollOpen(false)} palette={palette} dark={dark}
        question={pollQuestion} setQuestion={setPollQuestion}
        header={pollHeader} setHeader={setPollHeader}
        options={pollOptions} setOptions={setPollOptions}
        multi={pollMulti} setMulti={setPollMulti}
        onSend={() => void actions.sendPoll()}
      />
      <SignatureSheet
        open={sigOpen} onClose={() => setSigOpen(false)} palette={palette} dark={dark}
        kind={sigKind} setKind={setSigKind}
        desc={sigDesc} setDesc={setSigDesc}
        message={sigMessage} setMessage={setSigMessage}
        json={sigJson} setJson={setSigJson}
        onSend={() => void actions.sendSignatureRequest()}
      />
      <PaymentSheet
        open={txOpen} onClose={() => setTxOpen(false)} palette={palette} dark={dark}
        to={txTo} setTo={setTxTo}
        amount={txAmount} setAmount={setTxAmount}
        note={txNote} setNote={setTxNote}
        onSend={() => void actions.sendTxRequest()}
      />
    </Col>
  );
}
