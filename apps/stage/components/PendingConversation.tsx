
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Input } from '@stage-labs/kit/react-native/input';
import { Text } from '@stage-labs/kit/react-native/text';
import { shortAddress } from '@stage-labs/client/identity/format';
import { enqueueDm, flushDmOutboxFor, queuedDmsFor, subscribeDmOutbox } from '../lib/dmOutbox';
import { pendingBanner, type OutboxItem } from '../lib/dmOutbox.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { StackHeader } from './chrome/StackHeader';
import { Box, Col, Row } from './layout';

export type PendingReason = 'unregistered' | 'stale-installations' | 'failed';

function QueuedBubble({ item }: { item: OutboxItem }): React.ReactElement {
  const { border } = usePalette();
  return (
    <Row justify="end">
      <Box background={border} radius={16} padding={12} maxWidth="80%">
        <Text value={item.text} />
        <Text value="Queued" size="xs" role="secondary" />
      </Box>
    </Row>
  );
}

export function PendingConversation({ address, reason, onDelivered }: {
  address: string;
  reason: PendingReason;
  onDelivered: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [queued, setQueued] = useState<OutboxItem[]>(() => queuedDmsFor(address));
  const [draft, setDraft] = useState('');

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

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void enqueueDm(address, text).then(() =>
      flushDmOutboxFor(address).then(convId => { if (convId) onDelivered(); }),
    );
  }, [address, draft, onDelivered]);

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title={shortAddress(address)} />
      <Col flex={1} justify="end" gap={8} padding={16}>
        {queued.map(item => <QueuedBubble key={item.id} item={item} />)}
      </Col>
      <Col gap={12} padding={16}>
        <Text role="secondary" size="sm" textAlign="center" value={pendingBanner(reason, shortAddress(address))} />
        <Row gap={8} align="center">
          <Box flex={1}>
            <Input
              dark={dark}
              value={draft}
              placeholder="Message"
              onChangeText={setDraft}
              onSubmit={onSend}
            />
          </Box>
          <Button dark={dark} label="Send" disabled={!draft.trim()} onPress={onSend} />
        </Row>
      </Col>
    </Col>
  );
}
