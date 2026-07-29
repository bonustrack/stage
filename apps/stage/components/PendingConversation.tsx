
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { shortAddress } from '@stage-labs/client/identity/format';
import type { HistoryEntry } from '@stage-labs/client/types';
import { enqueueDm, flushDmOutboxFor, queuedDmsFor, subscribeDmOutbox } from '../lib/dmOutbox';
import { pendingBanner, type OutboxItem } from '../lib/dmOutbox.model';
import { getPeerName, usePeerProfiles } from '../lib/peerProfiles';
import { usePalette } from '../lib/theme';
import { flash } from '../lib/toast';
import { getActiveAccountIdSync, lineOfDmPeer } from '../modules/messaging';
import { Col } from './layout';
import { MessengerBubble } from './MessengerBubble';
import { ComposerEditor } from './MessengerComposer.editor';
import { TOPNAV_HEIGHT } from './Topnav';
import { ConvTopnavIdentity, ConvTopnavShell } from './xmtp-conv/parts';

export type PendingReason = 'unregistered' | 'stale-installations' | 'failed';

const PENDING_MY_URI = 'pending://me';

function entryOf(item: OutboxItem, myAddress: string | null, myName: string | null): HistoryEntry {
  return {
    id: `outbox-${item.id}`,
    ts: new Date(item.createdAt).toISOString(),
    station: 'xmtp',
    line: lineOfDmPeer(item.address),
    from: PENDING_MY_URI,
    fromName: myName ?? (myAddress ? shortAddress(myAddress) : 'You'),
    to: item.address,
    text: item.text,
  };
}

function PendingTopnav({ address, title }: { address: string; title: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  return (
    <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { router.replace('/'); }}>
      <ConvTopnavIdentity
        peerAddr={address} groupImage="" channelId={address} isGroup={false}
        border={border} head={head} title={title}
        onPress={() => { router.push({ pathname: '/profile/[address]', params: { address } }); }}
      />
    </ConvTopnavShell>
  );
}

function usePendingComposer(onSubmit: (text: string) => void): {
  editor: Omit<Parameters<typeof ComposerEditor>[0], 'dark' | 'fg' | 'head' | 'bg' | 'sub' | 'inputBg' | 'chipBg'>;
} {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const unavailable = useCallback(() => {
    flash('Available once this contact can receive messages');
  }, []);
  const onSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    onSubmit(trimmed);
  }, [text, onSubmit]);
  return {
    editor: {
      recording: false, levels: [], recordSecs: 0, slideThresholdPx: 80,
      text, setText, selection, setSelection,
      focusNonce: 0, blurNonce: 0,
      attachMenuOpen: false, setAttachMenuOpen: unavailable,
      hasContent: text.trim().length > 0,
      onStartRec: unavailable, onCancelRec: unavailable, onStopRec: unavailable,
      onSend,
    },
  };
}

export function PendingConversation({ address, reason, onDelivered, dark }: {
  address: string;
  reason: PendingReason;
  onDelivered: () => void;
  dark: boolean;
}): React.ReactElement {
  const pal = usePalette();
  const [queued, setQueued] = useState<OutboxItem[]>(() => queuedDmsFor(address));
  const myAddress = getActiveAccountIdSync();
  usePeerProfiles([address, myAddress]);
  const peerName = getPeerName(address) ?? shortAddress(address);
  const myName = getPeerName(myAddress ?? '') ?? null;

  useEffect(() => {
    const sync = (): void => { setQueued(queuedDmsFor(address)); };
    sync();
    return subscribeDmOutbox(sync);
  }, [address]);

  useEffect(() => {
    let alive = true;
    void flushDmOutboxFor(address).then(convId => { if (alive && convId) onDelivered(); });
    return () => { alive = false; };
  }, [address, onDelivered]);

  const onSubmit = useCallback((text: string) => {
    void enqueueDm(address, text).then(() =>
      flushDmOutboxFor(address).then(convId => { if (convId) onDelivered(); }),
    );
  }, [address, onDelivered]);

  const { editor } = usePendingComposer(onSubmit);

  return (
    <Col surface="surface" flex={1}>
      <PendingTopnav address={address} title={peerName}/>
      <Col flex={1} justify="end" padding={{ top: TOPNAV_HEIGHT }}>
        {queued.map(item => (
          <MessengerBubble
            key={item.id}
            entry={entryOf(item, myAddress, myName)}
            dark={dark}
            unread={false}
            pending
            myUri={PENDING_MY_URI}
            senderEthAddress={myAddress}
          />
        ))}
        <Text size="sm" color={pal.text} textAlign="center" style={{ paddingHorizontal: 24, paddingVertical: 12, opacity: 0.6 }}>
          {pendingBanner(reason, peerName)}
        </Text>
      </Col>
      <ComposerEditor
        dark={dark} fg={pal.text} head={pal.link} bg={pal.bg} sub={pal.text}
        inputBg={pal.inputBg} chipBg={pal.border}
        {...editor}
      />
    </Col>
  );
}
