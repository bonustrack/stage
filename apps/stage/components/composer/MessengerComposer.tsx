
import { Text } from '@stage-labs/kit/react-native/text';
import { FilePicker } from '@stage-labs/kit/react-native/file-picker';
import { Col, PAGE_GUTTER } from '../layout';
import { type Attachment, type OptimisticEntry } from './types';
import { useComposerActions } from './actions';
import { usePastedImages } from './pastedImages';
import {
  useComposerDrafts, useComposerFocus, useCaretToEnd,
  computeMentions, applyMention, useLastAttachment,
} from './hooks';
import { ReplyBanner, MentionPopup, PendingRow } from './parts';
import { ComposerEditor, AttachMenu, buildAttachActions } from './editor';
import { DANGER, usePalette } from '../../lib/theme';
import { convIdOfLine } from '../../modules/messaging';
import { useComposerState } from './state';
import { ComposerSheets } from './sheets';

interface Props {
  dark: boolean;
  xmtpLine: string;
  mentionCandidates?: { address: string; name: string }[];
  replyingTo?: { id: string; preview: string; sender?: string | null; nonce?: number };
  autoFocusNonce?: number;
  onClearReply?: () => void;
  onJumpToReply?: (messageId: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}

function loneCandidate(candidates: Props['mentionCandidates']): string | undefined {
  return candidates?.length === 1 ? candidates[0]?.address : undefined;
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
        <Text size="2xs" color={p.err ? DANGER : p.sub} style={{ paddingHorizontal: PAGE_GUTTER, paddingBottom: 4 }}>
          {p.err ?? 'Uploading…'}
        </Text>
      ) : null}
    </>
  );
}

export function MessengerComposer(props: Props): React.ReactElement {
  const { dark, xmtpLine, mentionCandidates, replyingTo, autoFocusNonce, onClearReply, onJumpToReply } = props;
  const pal = usePalette();
  const fg = pal.text, head = pal.link, chipBg = pal.border, bg = pal.bg;
  const sub = pal.text;

  const s = useComposerState();
  const actions = useComposerActions({ ...props, ...s });
  usePastedImages((files) => { void actions.onPickedImages(files); });
  const { SLIDE_CANCEL_THRESHOLD_PX } = actions;

  const convId = convIdOfLine(xmtpLine) ?? xmtpLine;
  const caretToEnd = useCaretToEnd(s.text, s.setSelection);
  useComposerDrafts(convId, s.text, s.setText, s.setSelection);
  useComposerFocus(s.bumpFocus, s.bumpBlur, replyingTo?.id, replyingTo?.nonce, autoFocusNonce, caretToEnd);

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
    openPoll: () => { s.setPollOpen(true); }, openSig: () => { s.setSigOpen(true); }, openTx: () => { s.setTxOpen(true); },
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
        dark={dark} fg={fg} head={head} bg={bg} sub={sub} chipBg={chipBg}
        recording={s.recording} levels={s.levels} recordSecs={s.recordSecs}
        slideThresholdPx={SLIDE_CANCEL_THRESHOLD_PX}
        text={s.text} setText={s.setText}
        selection={s.selection} setSelection={s.setSelection}
        focusNonce={s.focusNonce} blurNonce={s.blurNonce}
        attachMenuOpen={s.attachMenuOpen} setAttachMenuOpen={s.setAttachMenuOpen}
        quickIcon={quick?.[0]}
        quickLabel={quick?.[1]}
        onQuick={quick ? () => void quick[2]() : undefined}
        hasContent={hasContent}
        onStartRec={() => void actions.startRec()}
        onCancelRec={() => void actions.cancelRec()}
        onStopRec={() => void actions.stopRec()}
        onSend={() => void actions.send()}
      />
      {s.attachMenuOpen ? (
        <AttachMenu
          head={head} dark={dark}
          onClose={() => { s.setAttachMenuOpen(() => false); }}
          actions={attachActions}
        />
      ) : null}
      <ComposerSheets
        s={s} dark={dark} hooks={{ xmtpLine, setErr: s.setErr, onOptimistic: props.onOptimistic, onSent: props.onSent }}
        initialTo={loneCandidate(mentionCandidates)}
      />
      <FilePicker
        openNonce={actions.imageNonce}
        source="library"
        mediaTypes={['images', 'videos']}
        quality={0.5}
        multiple
        selectionLimit={10}
        onPick={(files) => { void actions.onPickedImages(files); }}
      />
      <FilePicker
        openNonce={actions.cameraNonce}
        source="camera"
        mediaTypes={['images']}
        quality={0.5}
        onPick={(files) => { void actions.onPickedCamera(files); }}
      />
      <FilePicker
        openNonce={actions.fileNonce}
        source="document"
        onPick={(files) => { void actions.onPickedFile(files); }}
      />
    </Col>
  );
}
