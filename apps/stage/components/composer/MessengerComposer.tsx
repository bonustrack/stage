import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import type { OptimisticEntry } from './types';
import { useComposerActions } from './actions';
import { useTakeHandedSend } from './handoff';
import { useWarmSendPath } from './useWarmSendPath';
import { useComposerState } from './state';
import { ComposerSheets } from './sheets';
import { useEffectiveColorScheme } from '../../lib/theme';
import { ComposerCore, useComposerCore, type ComposerCoreProps, type ReplyingTo } from './ComposerCore';

interface Props {
  xmtpLine: string;
  mentionCandidates?: { address: string; name: string }[];
  suggestContacts?: boolean;
  replyingTo?: ReplyingTo;
  autoFocusNonce?: number;
  onClearReply?: () => void;
  onRestoreReply?: () => void;
  onJumpToReply?: (messageId: string) => void;
  onOptimistic?: (entry: OptimisticEntry) => void;
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}

function loneCandidate(candidates: Props['mentionCandidates']): string | undefined {
  return candidates?.length === 1 ? candidates[0]?.address : undefined;
}

export function MessengerComposer(props: Props): React.ReactElement {
  const { xmtpLine, replyingTo, onClearReply, onJumpToReply } = props;
  const dark = useEffectiveColorScheme() === 'dark';
  const s = useComposerState();
  const convId = convIdOfLine(xmtpLine) ?? xmtpLine;
  const openLine = (): Promise<string | null> => Promise.resolve(xmtpLine);
  const actions = useComposerActions({ ...props, ...s, openLine });
  const coreProps: ComposerCoreProps = {
    s,
    actions,
    convId,
    draftKey: convId,
    draftOnly: false,
    mentionCandidates: props.mentionCandidates,
    suggestContacts: props.suggestContacts,
    autoFocusNonce: props.autoFocusNonce,
    reply: { replyingTo, onClearReply, onJumpToReply },
    onSend: () => {
      void actions.send();
    },
  };
  const core = useComposerCore(coreProps);
  useWarmSendPath(xmtpLine, s);
  useTakeHandedSend(convId, (started) => {
    void actions.adoptSend(started);
  });
  return (
    <ComposerCore {...coreProps} core={core}>
      <ComposerSheets
        s={s}
        dark={dark}
        hooks={{ openLine, setErr: s.setErr, onOptimistic: props.onOptimistic, onSent: props.onSent }}
        initialTo={loneCandidate(props.mentionCandidates)}
      />
    </ComposerCore>
  );
}
