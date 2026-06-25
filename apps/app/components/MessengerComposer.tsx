
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from './layout';
import { type Attachment } from './MessengerComposer.helpers';
import { useComposerActions } from './MessengerComposer.actions';
import { useComposerDrafts, useComposerFocus, computeMentions, applyMention, useLastAttachment } from './MessengerComposer.hooks';
import { ReplyBanner, MentionPopup, PendingRow } from './MessengerComposer.parts';
import { ComposerEditor, AttachMenu, buildAttachActions } from './MessengerComposer.editor';
import { DANGER, usePalette } from '../lib/theme';
import { useComposerState } from './MessengerComposer.state';
import { ComposerSheets } from './MessengerComposer.sheets.bound';

interface Props {
  dark: boolean;
  xmtpLine: string;
  mentionCandidates?: { address: string; name: string }[];
  replyingTo?: { id: string; preview: string; sender?: string | null; nonce?: number };
  autoFocusNonce?: number;
  onClearReply?: () => void;
  onJumpToReply?: (messageId: string) => void;
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string; payload?: unknown }) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}

function actionsArgs(props: Props, s: ReturnType<typeof useComposerState>) {
  return {
    xmtpLine: props.xmtpLine, text: s.text, pending: s.pending,
    replyingTo: props.replyingTo, mentionCandidates: props.mentionCandidates,
    setPending: s.setPending, setText: s.setText, setSending: s.setSending,
    setUploading: s.setUploading, setErr: s.setErr,
    setRecording: s.setRecording, setRecordSecs: s.setRecordSecs, setLevels: s.setLevels,
    setPollOpen: s.setPollOpen, pollQuestion: s.pollQuestion, pollHeader: s.pollHeader,
    pollOptions: s.pollOptions, pollMulti: s.pollMulti,
    setPollQuestion: s.setPollQuestion, setPollHeader: s.setPollHeader,
    setPollOptions: s.setPollOptions, setPollMulti: s.setPollMulti,
    setSigOpen: s.setSigOpen, sigKind: s.sigKind, sigDesc: s.sigDesc,
    sigMessage: s.sigMessage, sigJson: s.sigJson,
    setSigKind: s.setSigKind, setSigDesc: s.setSigDesc,
    setSigMessage: s.setSigMessage, setSigJson: s.setSigJson,
    setTxOpen: s.setTxOpen, txTo: s.txTo, txAmount: s.txAmount, txNote: s.txNote,
    setTxTo: s.setTxTo, setTxAmount: s.setTxAmount, setTxNote: s.setTxNote,
    onOptimistic: props.onOptimistic, onSent: props.onSent, onClearReply: props.onClearReply,
  };
}

function ComposerHeader(p: {
  dark: boolean; fg: string; head: string; sub: string; chipBg: string;
  replyingTo?: Props['replyingTo']; onClearReply?: () => void; onJumpToReply?: (id: string) => void;
  mentionRange: ReturnType<typeof computeMentions>['range'];
  mentionMatches: ReturnType<typeof computeMentions>['matches'];
  onPickMention: (c: { address: string; name: string }) => void;
  pending: Attachment[]; onRemovePending: (i: number) => void;
  uploading: boolean; err: string | null;
}): React.ReactElement {
  const { replyingTo, onJumpToReply } = p;
  return (
    <>
      {replyingTo ? (
        <ReplyBanner
          dark={p.dark} sub={p.sub} sender={replyingTo.sender} onClear={p.onClearReply}
          onPress={onJumpToReply ? () => { onJumpToReply(replyingTo.id); } : undefined}
        />
      ) : null}
      {p.mentionRange && p.mentionMatches.length > 0 ? (
        <MentionPopup dark={p.dark} head={p.head} matches={p.mentionMatches} onPick={p.onPickMention}/>
      ) : null}
      {p.pending.length > 0 ? (
        <PendingRow fg={p.fg} sub={p.sub} chipBg={p.chipBg} pending={p.pending} onRemove={p.onRemovePending} />
      ) : null}
      {p.uploading || p.err ? (
        <Text size="2xs" color={p.err ? DANGER : p.sub} style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
          {p.err ?? 'Uploading…'}
        </Text>
      ) : null}
    </>
  );
}

export function MessengerComposer(props: Props): React.ReactElement {
  const { dark, xmtpLine, mentionCandidates, replyingTo, autoFocusNonce, onClearReply, onJumpToReply } = props;
  const pal = usePalette();
  const fg = pal.text, head = pal.link, inputBg = pal.inputBg, chipBg = pal.border, bg = pal.bg;
  const sub = pal.text;
  const palette = { fg, sub, inputBg, chipBg };

  const s = useComposerState();
  const actions = useComposerActions(actionsArgs(props, s));
  const { slideX, micPanResponder, SLIDE_CANCEL_THRESHOLD_PX } = actions;

  const convId = xmtpLine.replace('metro://xmtp/', '');
  useComposerDrafts(convId, s.text, s.setText);
  useComposerFocus(s.bumpFocus, s.bumpBlur, replyingTo?.id, replyingTo?.nonce, autoFocusNonce);

  const hasContent = s.text.trim().length > 0 || s.pending.length > 0;

  const { matches: mentionMatches, range: mentionRange } = computeMentions(s.text, s.selection.start, mentionCandidates);
  const pickMention = (c: { address: string; name: string }): void => {
    if (!mentionRange) return;
    const { next, cursor } = applyMention(s.text, mentionRange, c.address);
    s.setText(next);
    s.setSelection({ start: cursor, end: cursor });
  };

  const attachActions = buildAttachActions({
    pickImage: actions.pickImage, takePhoto: actions.takePhoto,
    pickFile: actions.pickFile, pickLocation: actions.pickLocation,
    openPoll: () => { s.setPollOpen(true); }, openSig: () => { s.setSigOpen(true); }, openTx: () => { actions.openTx(); },
  });
  const lastLabel = useLastAttachment();
  const quick = attachActions.find(([, label]) => label === lastLabel);

  return (
    <Col padding={{ x: 0, top: 0, bottom: 0 }} surface="surface">
      <ComposerHeader
        dark={dark} fg={fg} head={head} sub={sub} chipBg={chipBg}
        replyingTo={replyingTo} onClearReply={onClearReply} onJumpToReply={onJumpToReply}
        mentionRange={mentionRange} mentionMatches={mentionMatches} onPickMention={pickMention}
        pending={s.pending} onRemovePending={(i) => { s.setPending(prev => prev.filter((_, j) => j !== i)); }}
        uploading={s.uploading} err={s.err}
      />
      <ComposerEditor
        dark={dark} fg={fg} head={head} bg={bg} sub={sub} inputBg={inputBg} chipBg={chipBg}
        recording={s.recording} levels={s.levels} recordSecs={s.recordSecs}
        slideX={slideX} slideThresholdPx={SLIDE_CANCEL_THRESHOLD_PX} micPanResponder={micPanResponder}
        text={s.text} setText={s.setText}
        selection={s.selection} setSelection={s.setSelection}
        focusNonce={s.focusNonce} blurNonce={s.blurNonce}
        attachMenuOpen={s.attachMenuOpen} setAttachMenuOpen={s.setAttachMenuOpen}
        quickIcon={quick?.[0]}
        onQuick={quick ? () => void quick[2]() : undefined}
        hasContent={hasContent}
        onCancelRec={() => void actions.cancelRec()}
        onStopRec={() => void actions.stopRec()}
        onSend={() => void actions.send()}
      />
      {}
      {s.attachMenuOpen ? (
        <AttachMenu
          head={head} inputBg={inputBg} chipBg={chipBg}
          onClose={() => { s.setAttachMenuOpen(() => false); }}
          actions={attachActions}
        />
      ) : null}
      <ComposerSheets s={s} palette={palette} dark={dark} actions={actions} />
    </Col>
  );
}
