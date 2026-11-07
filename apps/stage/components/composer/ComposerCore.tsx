import { Text } from '@stage-labs/kit/react-native/text';
import { FilePicker } from '@stage-labs/kit/react-native/file-picker';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconPaperclip3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperclip3';
import { useDictation } from './dictation';
import { useComposerActions } from './actions';
import { usePastedImages } from './pastedImages';
import { useDroppedFiles } from './droppedFiles';
import type { DropZone } from './droppedFiles.model';
import { useComposerDrafts, useComposerFocus, useCaretToEnd } from './hooks';
import { useLastAttachment } from '../../lib/drafts';
import { dictationOffered } from '../../lib/speech';
import { useChannelSuggest, useMentionEditor } from './mentions';
import { ReplyBanner, SuggestMenu, PendingRow } from './parts';
import { ComposerEditor, composerRadius } from './editor';
import { attachActionsOf, type AttachAction } from './attachActions';
import { quickAttachOf } from './attachActions.model';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { forgetAttachments } from '../../lib/xmtp.attachments';
import { fileInputs } from './send.model';
import type { ComposerState } from './state';
import { Column, PAGE_GUTTER, Row } from '../layout';

type ComposerActions = ReturnType<typeof useComposerActions>;

export interface ReplyingTo {
  id: string;
  sender?: string | null;
  nonce?: number;
}

export interface ComposerCoreProps {
  s: ComposerState;
  actions: ComposerActions;
  convId: string | null;
  draftKey: string | null;
  draftOnly: boolean;
  onSend: () => void;
  mentionCandidates?: { address: string; name: string }[];
  suggestContacts?: boolean;
  autoFocusNonce?: number;
  busy?: boolean;
  placeholder?: string;
  rounded?: boolean;
  quickAttach?: boolean;
  header?: React.ReactNode;
  reply?: { replyingTo?: ReplyingTo; onClearReply?: () => void; onJumpToReply?: (messageId: string) => void };
  children?: React.ReactNode;
}

function DropOverlay({ head }: { head: string }): React.ReactElement {
  const edge = { width: 2, color: head, style: 'dashed' };
  return (
    <Row
      pointerEvents="none"
      surface="surface"
      align="center"
      justify="center"
      gap={8}
      radius="lg"
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      style={{ position: 'absolute', top: 6, right: 6, bottom: 6, left: 6 }}
    >
      <Glyph icon={IconPaperclip3} size={20} color={head} />
      <Text fontWeight="semibold" size="xs" color={head}>
        Drop files to attach
      </Text>
    </Row>
  );
}

function useDroppedAndPasted(actions: ComposerActions, focus: () => void): DropZone {
  const focusUnlessKept = (keepFocus: boolean): void => {
    if (!keepFocus) focus();
  };
  const drop = useDroppedFiles((files, keepFocus) => {
    void actions.onDroppedFiles(files);
    focusUnlessKept(keepFocus);
  });
  usePastedImages((files, keepFocus) => {
    void actions.onPickedImages(files);
    focusUnlessKept(keepFocus);
  }, drop.zoneId);
  return drop;
}

function ComposerReply({ dark, sub, reply }: { dark: boolean; sub: string; reply: ComposerCoreProps['reply'] }): React.ReactElement | null {
  if (!reply?.replyingTo) return null;
  const { replyingTo, onJumpToReply } = reply;
  return (
    <ReplyBanner
      dark={dark}
      sub={sub}
      sender={replyingTo.sender}
      onClear={reply.onClearReply}
      onPress={
        onJumpToReply
          ? () => {
              onJumpToReply(replyingTo.id);
            }
          : undefined
      }
    />
  );
}

function ComposerHeader(p: { dark: boolean; fg: string; reply: ComposerCoreProps['reply']; s: ComposerState }): React.ReactElement {
  const { fg, s } = p;
  return (
    <>
      <ComposerReply dark={p.dark} sub={fg} reply={p.reply} />
      {s.pending.length > 0 ? (
        <PendingRow
          fg={fg}
          pending={s.pending}
          onRemove={(i) => {
            forgetAttachments(fileInputs(s.pending.filter((_, j) => j === i)));
            s.setPending((prev) => prev.filter((_, j) => j !== i));
          }}
        />
      ) : null}
      {s.uploading || s.err ? (
        <Text size="3xs" color={s.err ? DANGER : fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingBottom: 4 }}>
          {s.err ?? 'Uploading…'}
        </Text>
      ) : null}
    </>
  );
}

function useVoiceAndAttach(
  s: ComposerState,
  mention: ReturnType<typeof useMentionEditor>,
  actions: ComposerActions,
  o: { draftKey: string | null; draftOnly: boolean; busy: boolean; quickAttach: boolean },
) {
  const dictation = useDictation({
    key: o.draftKey,
    text: mention.display,
    selection: s.selection,
    setText: mention.setDisplay,
    setSelection: s.setSelection,
    setErr: s.setErr,
    recording: s.recording,
    busy: o.busy,
  });
  const startRecording = (): Promise<void> =>
    dictation.recordVoice(async () => {
      s.bumpBlur();
      await actions.startRec();
    });
  const attachActions = attachActionsOf(
    {
      voice: startRecording,
      image: actions.pickImage,
      camera: actions.takePhoto,
      file: actions.pickFile,
      location: actions.pickLocation,
      poll: () => {
        s.setPollOpen(true);
      },
      sign: () => {
        s.setSigOpen(true);
      },
      payment: () => {
        s.setTxOpen(true);
      },
    },
    { draftOnly: o.draftOnly, voiceInMenu: dictationOffered },
  );
  const last = useLastAttachment();
  const quick: AttachAction | undefined = o.quickAttach ? quickAttachOf(attachActions, last) : undefined;
  return { dictation, startRecording, attachActions, quick };
}

function ComposerFilePickers({ actions }: { actions: ComposerActions }): React.ReactElement {
  return (
    <>
      <FilePicker
        openNonce={actions.imageNonce}
        source="library"
        mediaTypes={['images', 'videos']}
        quality={0.5}
        multiple
        selectionLimit={10}
        onPick={(files) => {
          void actions.onPickedImages(files);
        }}
      />
      <FilePicker
        openNonce={actions.cameraNonce}
        source="camera"
        mediaTypes={['images']}
        quality={0.5}
        onPick={(files) => {
          void actions.onPickedCamera(files);
        }}
      />
      <FilePicker
        openNonce={actions.fileNonce}
        source="document"
        onPick={(files) => {
          void actions.onPickedFile(files);
        }}
      />
    </>
  );
}

function useComposerCore(p: ComposerCoreProps) {
  const { s, actions } = p;
  const mention = useMentionEditor(s, p.mentionCandidates, p.suggestContacts === true);
  const caretToEnd = useCaretToEnd(mention.display, s.setSelection);
  const drop = useDroppedAndPasted(actions, () => {
    caretToEnd();
    s.bumpFocus();
  });
  useComposerDrafts(p.draftKey, s, mention.restore);
  const replyingTo = p.reply?.replyingTo;
  useComposerFocus(s.bumpFocus, s.bumpBlur, s.blurNonce, replyingTo?.id, replyingTo?.nonce, p.autoFocusNonce, caretToEnd);
  const channels = useChannelSuggest(s, p.convId ?? '');
  const voice = useVoiceAndAttach(s, mention, actions, {
    draftKey: p.draftKey,
    draftOnly: p.draftOnly,
    busy: p.busy === true,
    quickAttach: p.quickAttach !== false,
  });
  return { mention, drop, channels, voice };
}

export function ComposerCore(p: ComposerCoreProps): React.ReactElement {
  const { s, actions } = p;
  const { mention, drop, channels, voice } = useComposerCore(p);
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const { dictation, startRecording, attachActions, quick } = voice;
  return (
    <Column nativeID={drop.zoneId} padding={{ x: 0, top: 0, bottom: 0 }} background={pal.border} radius={composerRadius(p.rounded)}>
      <SuggestMenu suggest={mention} />
      <SuggestMenu suggest={channels} />
      {p.header}
      <ComposerHeader dark={dark} fg={pal.text} reply={p.reply} s={s} />
      <ComposerEditor
        dark={dark}
        fg={pal.text}
        head={pal.link}
        bg={pal.bg}
        sub={pal.text}
        chipBg={pal.border}
        recording={s.recording}
        levels={s.levels}
        recordSecs={s.recordSecs}
        text={mention.display}
        setText={dictation.setText}
        selection={s.selection}
        setSelection={s.setSelection}
        focusNonce={s.focusNonce}
        blurNonce={s.blurNonce}
        attachMenuOpen={s.attachMenuOpen}
        setAttachMenuOpen={s.setAttachMenuOpen}
        attachActions={attachActions}
        quick={quick}
        hasContent={s.text.trim().length > 0 || s.pending.length > 0}
        busy={p.busy}
        dictation={dictationOffered ? dictation : undefined}
        placeholder={p.placeholder}
        rounded={p.rounded}
        onMentionKey={(key, shift) => channels.onKey(key, shift) || mention.onKey(key, shift)}
        onStartRec={() => void startRecording()}
        onCancelRec={() => void actions.cancelRec()}
        onStopRec={() => void actions.stopRec()}
        onSend={p.onSend}
      />
      {p.children}
      <ComposerFilePickers actions={actions} />
      {drop.active ? <DropOverlay head={pal.link} /> : null}
    </Column>
  );
}
