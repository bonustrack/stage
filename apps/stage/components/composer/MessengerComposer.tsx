
import { Text } from '@stage-labs/kit/react-native/text';
import { FilePicker } from '@stage-labs/kit/react-native/file-picker';
import { Col, PAGE_GUTTER } from '../layout';
import { type Attachment, type OptimisticEntry } from './types';
import { useComposerActions } from './actions';
import { useHandedSend } from './handoff';
import { usePastedImages } from './pastedImages';
import { useDroppedFiles } from './droppedFiles';
import type { DropZone } from './droppedFiles.model';
import { DropOverlay } from './dropOverlay';
import { useComposerDrafts, useComposerFocus, useCaretToEnd, useLastAttachment } from './hooks';
import { useMentionEditor } from './mentions';
import { ReplyBanner, MentionMenu, ChannelSuggestMenu, PendingRow } from './parts';
import { useChannelSuggest } from './channels';
import { ComposerEditor, buildAttachActions, composerRadius } from './editor';
import { DANGER, usePalette } from '../../lib/theme';
import { convIdOfLine, forgetAttachments } from '../../modules/messaging';
import { fileInputs } from './send.model';
import { useComposerState, type ComposerState } from './state';
import { ComposerSheets } from './sheets';
import { TEXT_12PX } from '../smallText';

const DRAFT_ATTACH_LABELS = new Set(['Image', 'Camera', 'File']);

interface Props {
  dark: boolean;
  xmtpLine?: string;
  draftKey?: string | null;
  state?: ComposerState;
  mentionCandidates?: { address: string; name: string }[];
  suggestContacts?: boolean;
  replyingTo?: { id: string; preview: string; sender?: string | null; nonce?: number };
  autoFocusNonce?: number;
  busy?: boolean;
  placeholder?: string;
  rounded?: boolean;
  onClearReply?: () => void;
  onJumpToReply?: (messageId: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
  onSubmit?: () => void;
}

function loneCandidate(candidates: Props['mentionCandidates']): string | undefined {
  return candidates?.length === 1 ? candidates[0]?.address : undefined;
}

function composerTarget(xmtpLine: string | undefined, draftKey: string | null | undefined): {
  convId: string | null; draftKey: string | null; openLine: () => Promise<string | null>;
} {
  const line = xmtpLine ?? null;
  const convId = line === null ? null : convIdOfLine(line) ?? line;
  return { convId, draftKey: draftKey ?? convId, openLine: () => Promise.resolve(line) };
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

function useDroppedAndPasted(actions: ReturnType<typeof useComposerActions>, focus: () => void): DropZone {
  const focusUnlessKept = (keepFocus: boolean): void => { if (!keepFocus) focus(); };
  const drop = useDroppedFiles((files, keepFocus) => { void actions.onDroppedFiles(files); focusUnlessKept(keepFocus); });
  usePastedImages((files, keepFocus) => { void actions.onPickedImages(files); focusUnlessKept(keepFocus); }, drop.zoneId);
  return drop;
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
  const { convId, draftKey, openLine } = composerTarget(props.xmtpLine, props.draftKey);
  const actions = useComposerActions({ ...props, ...s, openLine });
  const { SLIDE_CANCEL_THRESHOLD_PX } = actions;

  const mention = useMentionEditor(s, mentionCandidates, props.suggestContacts === true);
  const caretToEnd = useCaretToEnd(mention.display, s.setSelection);
  const drop = useDroppedAndPasted(actions, () => { caretToEnd(); s.bumpFocus(); });
  useComposerDrafts(draftKey, s, mention.restore);
  useHandedSend(convId, (started) => { void actions.adoptSend(started); });
  useComposerFocus(s.bumpFocus, s.bumpBlur, s.blurNonce, replyingTo?.id, replyingTo?.nonce, autoFocusNonce, caretToEnd);
  const channels = useChannelSuggest(s, convId ?? '');

  const hasContent = s.text.trim().length > 0 || s.pending.length > 0;

  const attachActions = composerAttachActions(actions, s, draftOnly);
  const lastLabel = useLastAttachment();
  const quick = attachActions.find(([, label]) => label === lastLabel);

  return (
    <Col nativeID={drop.zoneId} padding={{ x: 0, top: 0, bottom: 0 }} background={pal.border} radius={composerRadius(props.rounded)}>
      <MentionMenu matches={mention.matches} active={mention.active} onPick={mention.pick}/>
      <ChannelSuggestMenu matches={channels.matches} active={channels.active} onPick={channels.pick}/>
      <ComposerHeader
        dark={dark} fg={fg} sub={sub}
        replyingTo={replyingTo} onClearReply={onClearReply} onJumpToReply={onJumpToReply}
        pending={s.pending} onRemovePending={(i) => {
          forgetAttachments(fileInputs(s.pending.filter((_, j) => j === i)));
          s.setPending(prev => prev.filter((_, j) => j !== i));
        }}
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
        busy={props.busy}
        placeholder={props.placeholder}
        rounded={props.rounded}
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
