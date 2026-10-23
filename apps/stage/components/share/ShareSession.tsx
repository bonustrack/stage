import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { AppModal } from '../AppModal';
import { Col } from '../layout';
import { useComposerState, type ComposerState } from '../composer/state';
import { fileInputs } from '../composer/send.model';
import { prepareAttachments, forgetAttachments } from '../../lib/xmtp.attachments';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { knownActiveAccountId, subscribeCachedRows } from '../../lib/channelsCache';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { useClearedChats } from '../../lib/clearedChats';
import { useStoreValue } from '../../lib/storeCore';
import { checkShareDestination } from '../../lib/shareDestination';
import type { IncomingShare } from '../../lib/incomingShare.types';
import { sharedAttachments, shareDestinations, type ShareDestination } from './share.model';
import { SharePicker } from './SharePicker';
import { ShareReview } from './ShareReview';
import { useShareRows } from './useShareRows';
import { useShareSender, type ShareSelection } from './useShareSender';
import { useEffectiveColorScheme } from '../../lib/theme';

function sessionTitle(sent: boolean, selected: boolean): string {
  if (sent) return 'Share sent';
  return selected ? 'Review share' : 'Share to Stage';
}

function useSharedComposer(share: Extract<IncomingShare, { status: 'ready' }>) {
  const state = useComposerState(sharedAttachments(share));
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    prepareAttachments(fileInputs(state.pending));
    return () => { forgetAttachments(fileInputs(current.current.pending)); };
  }, []);
  return state;
}

function ShareSessionBody({ send, selection, state, accountLabel, picker, onChoose }: {
  send: ReturnType<typeof useShareSender>; selection: ShareSelection | null; state: ComposerState;
  accountLabel: string; picker: ReactNode; onChoose: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const waiting = send.sent || send.busy || send.closed;
  return (
    <Col gap={12}>
      {send.error === null ? null : <Text color="danger">{send.error}</Text>}
      {waiting ? <Text>{send.sent ? 'Your share was sent.' : send.closed ? 'Closing this share…' : 'Finishing the share you confirmed…'}</Text> : selection === null ? picker : (
        <ShareReview destination={selection.destination} state={state} account={accountLabel} busy={send.busy}
          onChoose={onChoose} onSubmit={() => { void send.sender.send(); }}/>
      )}
      <Button dark={dark} label={send.sent ? 'Close' : 'Cancel share'} variant="soft" color="secondary" disabled={send.busy} onPress={send.close}/>
    </Col>
  );
}

export function ShareSession({ share, active, onDismiss }: {
  share: Extract<IncomingShare, { status: 'ready' }>; active: boolean; onDismiss: (keepFiles: boolean) => Promise<void>;
}): React.ReactElement {
  const state = useSharedComposer(share);
  const epoch = useAccountEpoch();
  const accountId = useStoreValue(subscribeCachedRows, knownActiveAccountId);
  const account = useActiveAccountRecord();
  const accountReady = account?.id === accountId ? accountId : null;
  const list = useShareRows(accountReady, epoch);
  const cleared = useClearedChats();
  const [selected, setSelected] = useState<ShareSelection | null>(null);
  const [checking, setChecking] = useState(false);
  const selection = selected?.accountId === accountReady && selected.epoch === epoch ? selected : null;
  const send = useShareSender({ state, selection, active, onDismiss });
  const choose = async (destination: ShareDestination): Promise<void> => {
    if (accountReady === null || checking || send.sender.isBusy()) return;
    setChecking(true);
    send.setError(null);
    try {
      await checkShareDestination(accountReady, epoch, destination);
      setSelected({ destination, accountId: accountReady, epoch });
    } catch { send.setError('This channel is not ready to receive shares. Choose another channel or refresh.'); }
    finally { setChecking(false); }
  };
  const accountLabel = account?.id === accountReady ? account.label ?? account.address : 'Opening account…';
  return (
    <AppModal visible={active} title={sessionTitle(send.sent, selection !== null)} onClose={send.close} dismissable={!send.busy}>
      <ShareSessionBody send={send} selection={selection} state={state} accountLabel={accountLabel} onChoose={() => { setSelected(null); }}
        picker={<SharePicker rows={shareDestinations(list.rows, cleared, '')} loading={list.loading || accountReady === null}
          checking={checking} error={list.error} account={accountLabel} onChoose={row => { void choose(row); }} onRetry={list.refresh}/>}/>
    </AppModal>
  );
}
