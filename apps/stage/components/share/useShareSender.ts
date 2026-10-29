import { useEffect, useRef, useState } from 'react';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { startSend, showSend, finishSend, type StartedSend } from '../composer/sendRun';
import type { ComposerState } from '../composer/state';
import { assertShareAccount, checkShareDestination } from '../../lib/shareDestination';
import { getAccountEpoch } from '../../lib/accountEpoch';
import { knownActiveAccountId } from '../../lib/channelsCache';
import { capabilities } from '../../lib/capabilities';
import { conversationSharePath } from '../../lib/links';
import { stashLocalAttachment } from '../../lib/localAttachmentCache';
import { currentShareDraft, makeShareSender } from './shareSend.model';
import type { ShareDestination } from './share.model';

export interface ShareSelection {
  destination: ShareDestination;
  accountId: string;
  epoch: number;
}

export function useShareSender(props: {
  state: ComposerState;
  selection: ShareSelection | null;
  active: boolean;
  onDismiss: (keepFiles: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const previews = useRef(new Map<string, string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = useRef(props);
  current.current = props;
  const sentRef = useRef(false);
  const [sender] = useState(() =>
    makeShareSender<StartedSend>({
      validate: async () => {
        const picked = current.current.selection;
        if (picked === null || !current.current.active || !mounted.current) throw new Error('Choose a channel first.');
        const context = await checkShareDestination(picked.accountId, picked.epoch, picked.destination);
        return () => {
          context.assertCurrent();
          assertShareAccount(picked.accountId, picked.epoch);
          if (current.current.selection !== picked || !current.current.active || !mounted.current)
            throw new Error('Choose a channel again.');
        };
      },
      start: (assertCurrent) => {
        const { state: draft, selection: picked } = current.current;
        if (picked === null || draft.uploading || draft.recording || (!draft.text.trim() && draft.pending.length === 0))
          throw new Error('Nothing to send.');
        const started = startSend(lineOfConv(picked.destination.convId), draft.text, draft.pending, undefined, {
          assertCurrent,
          beforeSend: async () => {
            await checkShareDestination(picked.accountId, picked.epoch, picked.destination);
            assertCurrent();
          },
          previewUri: (uri) => {
            const saved = previews.current.get(uri);
            if (saved !== undefined) return saved;
            const savedUri = stashLocalAttachment(uri);
            if (uri.includes('/stage-shares/') && savedUri === uri) throw new Error('Could not retain the shared preview. Try again.');
            previews.current.set(uri, savedUri);
            return savedUri;
          },
        });
        showSend(draft, started);
        return started;
      },
      finish: async (started) => {
        await finishSend(current.current.state, started, () => currentShareDraft(current.current.state, started));
        return (await Promise.all(started.runs.map((run) => run.outcome))).every((outcome) => 'id' in outcome);
      },
      success: async () => {
        sentRef.current = true;
        setSent(true);
        const picked = current.current.selection;
        await current.current.onDismiss(true);
        capabilities.toast('Shared to channel');
        if (picked !== null && getAccountEpoch() === picked.epoch && knownActiveAccountId() === picked.accountId) {
          capabilities.navigate(conversationSharePath(picked.destination.convId, picked.destination.peerAddress));
        }
      },
      busy: setBusy,
      error: () => {
        setError(
          sentRef.current
            ? 'Message sent. Close this share to continue.'
            : 'Could not share. Check the active account and channel, then try again.',
        );
      },
    }),
  );
  const close = (): void => {
    if (!sender.close()) return;
    setClosed(true);
    void current.current.onDismiss(sentRef.current).catch(() => {
      setError('Could not close this share. Try again.');
    });
  };
  return { sender, busy, sent, closed, error, setError, close };
}
