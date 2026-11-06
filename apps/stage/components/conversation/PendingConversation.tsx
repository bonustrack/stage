import { useCallback, useEffect, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import type { HistoryEntry } from '@stage-labs/client/types';
import { enqueueDm, flushDmOutboxFor, queuedDmsFor, subscribeDmOutbox } from '../../lib/dmOutbox';
import { pendingBanner, type OutboxItem } from '../../lib/dmOutbox.model';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { knownActiveAccountId } from '../../lib/accountSelection';
import { lineOfDmPeer } from '@stage-labs/client/xmtp/line';
import { MessengerBubble } from '../bubble/MessengerBubble';
import type { BubbleModel } from '../bubble/model';
import { ComposerEditor } from '../composer/editor';
import { TOPNAV_HEIGHT } from '../Topnav';
import { PeerTopnav } from './PeerTopnav';
import { ChatColumn, ComposerDock } from './FooterDock';
import { Column } from '../layout';

type PendingReason = 'unregistered' | 'stale-installations' | 'failed';

const PENDING_MY_URI = 'pending://me';

function entryOf(item: OutboxItem): HistoryEntry {
  return {
    id: `outbox-${item.id}`,
    ts: new Date(item.createdAt).toISOString(),
    station: 'xmtp',
    line: lineOfDmPeer(item.address),
    from: PENDING_MY_URI,
    to: item.address,
    text: item.text,
  };
}

function pendingModelOf(entry: HistoryEntry, dark: boolean, senderEthAddress: string | null): BubbleModel {
  return {
    entry,
    source: entry,
    dark,
    myUri: PENDING_MY_URI,
    senderEthAddress,
    pending: true,
    replyTarget: false,
    interactive: false,
    signable: false,
    signing: false,
    payable: false,
    paying: false,
    selectable: false,
  };
}

function usePendingComposer(
  onSubmit: (text: string) => void,
): Omit<Parameters<typeof ComposerEditor>[0], 'dark' | 'fg' | 'head' | 'bg' | 'sub' | 'chipBg'> {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const unavailable = useCallback(() => {
    capabilities.toast('Available once this contact can receive messages');
  }, []);
  const onSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    onSubmit(trimmed);
  }, [text, onSubmit]);
  return {
    recording: false,
    levels: [],
    recordSecs: 0,
    text,
    setText,
    selection,
    setSelection,
    focusNonce: 0,
    blurNonce: 0,
    attachMenuOpen: false,
    setAttachMenuOpen: unavailable,
    hasContent: text.trim().length > 0,
    onStartRec: unavailable,
    onCancelRec: unavailable,
    onStopRec: unavailable,
    onSend,
  };
}

export function PendingConversation({
  address,
  reason,
  onDelivered,
  dark,
}: {
  address: string;
  reason: PendingReason;
  onDelivered: () => void;
  dark: boolean;
}): React.ReactElement {
  const pal = usePalette();
  const [queued, setQueued] = useState<OutboxItem[]>(() => queuedDmsFor(address));
  const myAddress = knownActiveAccountId();
  usePeerProfiles([address, myAddress]);
  const peerName = peerLabel(address);

  useEffect(() => {
    const sync = (): void => {
      setQueued(queuedDmsFor(address));
    };
    sync();
    return subscribeDmOutbox(sync);
  }, [address]);

  useEffect(() => {
    let alive = true;
    void flushDmOutboxFor(address).then((convId) => {
      if (alive && convId) onDelivered();
    });
    return () => {
      alive = false;
    };
  }, [address, onDelivered]);

  const onSubmit = useCallback(
    (text: string) => {
      void enqueueDm(address, text).then(() =>
        flushDmOutboxFor(address).then((convId) => {
          if (convId) onDelivered();
        }),
      );
    },
    [address, onDelivered],
  );

  const editor = usePendingComposer(onSubmit);

  return (
    <Column surface="surface" weight={1}>
      <PeerTopnav peer={address} />
      <ChatColumn>
        <Column weight={1} justify="end" padding={{ top: TOPNAV_HEIGHT }}>
          {queued.map((item) => (
            <MessengerBubble key={item.id} model={pendingModelOf(entryOf(item), dark, myAddress)} />
          ))}
          <Text size="2xs" color={pal.text} textAlign="center" style={{ paddingHorizontal: 24, paddingVertical: 12, opacity: 0.6 }}>
            {pendingBanner(reason, peerName)}
          </Text>
        </Column>
      </ChatColumn>
      <ComposerDock>
        <ComposerEditor dark={dark} fg={pal.text} head={pal.link} bg={pal.bg} sub={pal.text} chipBg={pal.border} {...editor} />
      </ComposerDock>
    </Column>
  );
}
