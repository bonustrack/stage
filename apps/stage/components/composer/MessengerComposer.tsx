
import { Text } from '@stage-labs/kit/react-native/text';
import { FilePicker } from '@stage-labs/kit/react-native/file-picker';
import { Col, PAGE_GUTTER } from '../layout';
import { type Attachment, type OptimisticEntry } from './types';
import { useComposerActions } from './actions';
import { usePastedImages } from './pastedImages';
import { useDroppedFiles } from './droppedFiles';
import { DropOverlay } from './dropOverlay';
import { useComposerDrafts, useComposerFocus, useCaretToEnd, useLastAttachment } from './hooks';
import { useMentionEditor } from './mentions';
import { ReplyBanner, MentionMenu, ChannelSuggestMenu, PendingRow } from './parts';
import { useChannelSuggest } from './channels';
import { ComposerEditor, buildAttachActions } from './editor';
import { DANGER, usePalette } from '../../lib/theme';
import { convIdOfLine } from '../../modules/messaging';
import { useComposerState, type ComposerState } from './state';
import { ComposerSheets } from './sheets';
import { TEXT_12PX } from '../smallText';

const DRAFT_ATTACH_LABELS = new Set(['Image', 'Camera', 'File']);

interface Props {
  dark: boolean;
  xmtpLine?: string;
  state?: ComposerState;
  mentionCandidates?: { address: string; name: string }[];
  suggestContacts?: boolean;
  replyingTo?: { id: string; preview: string; sender?: string | null; nonce?: number };
  autoFocusNonce?: number;
  onClearReply?: () => void;
  onJumpToReply?: (messageId: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
  onSubmit?: () => void;
}

function loneCandidate(candidates: Props['mentionCandidates']): string | undefined {
  return candidates?.length === 1 ? candidates[0]?.address : undefined;
}

function composerTarget(xmtpLine: string | undefined): { convId: string | null; openLine: () => Promise<string | null> } {
  const line = xmtpLine ?? null;
  return { convId: line === null ? null : convIdOfLine(line) ?? line, openLine: () => Promise.resolve(line) };
}

function sendHandler(onSubmit: (() => void) | undefined, send: () => Promise<void>): () => void {
  return onSubmit ?? (() => { void send(); });
}

function useDraftState(shared: ComposerState | undefined): ComposerState {
  const own = useComposerState();
  return shared ?? own;
}

function composerAttachActions(
  actions: ReturnType<typeof useComposerActions>, s: ComposerState, draftOnly: boolean,
): ReturnType<typeof buildAttachActions> {
  const all = buildAttachActions({
    pickImage: actions.pickImage, takePhoto: actions.takePhoto,
    pickFile: actions.pickFile, pickLocation: actions.pickLocation,
    openPoll: () => { s.setPollOpen(true); }, openSig: () => { s.setSigOpen(true); }, openTx: () => { s.setTxOpen(true); },
  });
  return draftOnly ? all.filter(([, label]) => DRAFT_ATTACH_LABELS.has(label)) : all;
}

function ComposerHeader(p: {
  dark: boolean; fg: string; sub: string;
  replyingTo?: Props['replyingTo']; onClearReply?: () => void; onJumpToReply?: (id: string) => void;
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
      {p.pending.length > 0 ? (
        <PendingRow fg={p.fg} pending={p.pending} onRemove={p.onRemovePending} />
      ) : null}
      {p.uploading || p.err ? (
        <Text color={p.err ? DANGER : p.sub} style={[TEXT_12PX, { paddingHorizontal: PAGE_GUTTER, paddingBottom: 4 }]}>
          {p.err ?? 'Uploading…'}
        </Text>
      ) : null}
    </>
  );
}

export function MessengerComposer(props: Props): React.ReactElement {
  const { dark, mentionCandidates, replyingTo, autoFocusNonce, onClearReply, onJumpToReply } = props;
  const pal = usePalette();
  const fg = pal.text, head = pal.link, chipBg = pal.border, bg = pal.bg;
  const sub = pal.text;

  const s = useDraftState(props.state);
  const draftOnly = props.xmtpLine === undefined;
  const { convId, openLine } = composerTarget(props.xmtpLine);
  const actions = useComposerActions({ ...props, ...s, openLine });
  usePastedImages((files) => { void actions.onPickedImages(files); });
  const drop = useDroppedFiles((files) => { void actions.onDroppedFiles(files); });
  const { SLIDE_CANCEL_THRESHOLD_PX } = actions;

  const mention = useMentionEditor(s, mentionCandidates, props.suggestContacts === true);
  const caretToEnd = useCaretToEnd(mention.display, s.setSelection);
  useComposerDrafts(convId, s.text, mention.restore);
  useComposerFocus(s.bumpFocus, s.bumpBlur, s.blurNonce, replyingTo?.id, replyingTo?.nonce, autoFocusNonce, caretToEnd);
  const channels = useChannelSuggest(s, convId ?? '');

  const hasContent = s.text.trim().length > 0 || s.pending.length > 0;

  const attachActions = composerAttachActions(actions, s, draftOnly);
  const lastLabel = useLastAttachment();
  const quick = attachActions.find(([, label]) => label === lastLabel);

  return (
    <Col nativeID={drop.zoneId} padding={{ x: 0, top: 0, bottom: 0 }} background={pal.border}>
      <MentionMenu matches={mention.matches} active={mention.active} onPick={mention.pick}/>
      <ChannelSuggestMenu matches={channels.matches} active={channels.active} onPick={channels.pick}/>
      <ComposerHeader
        dark={dark} fg={fg} sub={sub}
        replyingTo={replyingTo} onClearReply={onClearReply} onJumpToReply={onJumpToReply}
        pending={s.pending} onRemovePending={(i) => { s.setPending(prev => prev.filter((_, j) => j !== i)); }}
        uploading={s.uploading} err={s.err}
      />
      <ComposerEditor
        dark={dark} fg={fg} head={head} bg={bg} sub={sub} chipBg={chipBg}
        recording={s.recording} levels={s.levels} recordSecs={s.recordSecs}
        slideThresholdPx={SLIDE_CANCEL_THRESHOLD_PX}
        text={mention.display} setText={mention.setDisplay}
        selection={s.selection} setSelection={s.setSelection}
        focusNonce={s.focusNonce} blurNonce={s.blurNonce}
        attachMenuOpen={s.attachMenuOpen} setAttachMenuOpen={s.setAttachMenuOpen} attachActions={attachActions}
        quickIcon={quick?.[0]}
        quickLabel={quick?.[1]}
        onQuick={quick ? () => void quick[2]() : undefined}
        hasContent={hasContent}
        onMentionKey={(key, shift) => channels.onKey(key, shift) || mention.onKey(key, shift)}
        onStartRec={() => void actions.startRec()}
        onCancelRec={() => void actions.cancelRec()}
        onStopRec={() => void actions.stopRec()}
        onSend={sendHandler(props.onSubmit, actions.send)}
      />
      {draftOnly ? null : (
        <ComposerSheets
          s={s} dark={dark} hooks={{ openLine, setErr: s.setErr, onOptimistic: props.onOptimistic, onSent: props.onSent }}
          initialTo={loneCandidate(mentionCandidates)}
        />
      )}
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
      {drop.active ? <DropOverlay head={head}/> : null}
    </Col>
  );
}
