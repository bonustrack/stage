/** @file Guardian social-recovery UI parts: the guardian editor, pending-recovery card and guardian approval card. */

import { useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/input';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Pressable } from '@stage-labs/kit/pressable';
import { Box, Row, Col } from '../../components/layout';
import type { FormPal } from './wallet.form';
import { Segmented } from './wallet.form';
import { dedupeGuardians, DEFAULT_RECOVERY_DELAY_SECONDS } from '@stage-labs/client/zerodev/recovery';

/** Format a delay (seconds) as a short human window for display. */
export function formatDelay(seconds: number): string {
  const h = Math.round(seconds / 3600);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** Skippable guardian setup (friend addresses + M-of-N picker); presentational with local edit state, page owns persistence. */
export function GuardianEditor({
  pal, dark, guardians, threshold, delaySeconds = DEFAULT_RECOVERY_DELAY_SECONDS,
  onChange, onThreshold,
}: {
  pal: FormPal; dark: boolean;
  guardians: string[]; threshold: number; delaySeconds?: number;
  onChange: (next: string[]) => void;
  onThreshold: (m: number) => void;
}): React.ReactElement {
  const { head, sub, link } = pal;
  const [entry, setEntry] = useState('');

  /** Add helper. */
  const add = (): void => {
    const next = dedupeGuardians([...guardians, entry]);
    if (next.length !== guardians.length) {
      onChange(next);
      /** Keep threshold within 1..N. */
      if (threshold > next.length) onThreshold(next.length);
    }
    setEntry('');
  };
  /** Remove helper. */
  const remove = (addr: string): void => {
    const next = guardians.filter(g => g !== addr);
    onChange(next);
    if (threshold > next.length && next.length > 0) onThreshold(next.length);
  };

  const n = guardians.length;
  const thresholdOptions = Array.from({ length: n }, (_, i) => [i + 1, `${i + 1}`] as const);

  return (
    <Col gap={16}>
      <Box gap={6}>
        <Text size="xs" color={sub}>GUARDIAN ADDRESS OR ENS</Text>
        <Row gap={8} align="center">
          <Col surface="raised" radius="lg" padding={{ x: 14, y: 12 }} flex={1}>
            <Input value={entry} onChangeText={setEntry} placeholder="0x… or name.eth" placeholderTextColor={sub}
              disabled={false} dark={dark} inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
              style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium', padding: 0,
                backgroundColor: 'transparent', minHeight: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0 }}/>
          </Col>
          <Button variant="secondary" size="md" pill dark={dark} onPress={add} disabled={!entry.trim()} label="Add"/>
        </Row>
      </Box>

      {n > 0 ? (
        <Col gap={8}>
          <Text size="xs" color={sub}>GUARDIANS ({n})</Text>
          {guardians.map(addr => (
            <Row key={addr} surface="raised" radius="lg" padding={{ x: 14, y: 10 }} align="center" gap={8}>
              <Text size="sm" color={head} style={{ flex: 1 }} numberOfLines={1} ellipsizeMode="middle">{addr}</Text>
              <Pressable onPress={() => { remove(addr); }} hitSlop={8} style={{ padding: 2 }}>
                <Icon name="x" size={18} color={sub}/>
              </Pressable>
            </Row>
          ))}
        </Col>
      ) : (
        <Text size="sm" color={sub}>
          Add friends as guardians. If you lose this device, a threshold of them can restore your wallet — they never gain access to your funds.
        </Text>
      )}

      {n > 0 ? (
        <Segmented dark={dark} label={`RECOVERY THRESHOLD (need ${threshold} of ${n})`}
          value={threshold} options={thresholdOptions} onChange={onThreshold}/>
      ) : null}

      <Text size="xs" color={sub}>
        A recovery opens a {formatDelay(delaySeconds)} cancel window. You are notified and can cancel with your key before it takes effect.{' '}
        <Text size="xs" color={link}>Funds can never move during recovery.</Text>
      </Text>
    </Col>
  );
}

/** A live pending rotation with a one-tap owner Cancel (native veto). Shown when proposalStatus is Ongoing/Approved and the timelock window has not elapsed. */
export function PendingRecoveryCard({
  pal, dark, newOwner, finalizeAfterLabel, onCancel, cancelling,
}: {
  pal: FormPal; dark: boolean;
  newOwner: string; finalizeAfterLabel: string;
  onCancel: () => void; cancelling: boolean;
}): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} gap={10} style={{ borderWidth: 1, borderColor: border }}>
      <Row align="center" gap={8}>
        <Icon name="exclamationCircle" size={18} color={head}/>
        <Text weight="semibold" size="md" color={head} style={{ flex: 1 }}>Recovery in progress</Text>
      </Row>
      <Text size="sm" color={sub}>
        Your wallet is being rotated to a new owner. It takes effect {finalizeAfterLabel} unless you cancel.
      </Text>
      <Text size="xs" color={sub} numberOfLines={1} ellipsizeMode="middle">New owner: {newOwner}</Text>
      <Button variant="primary" size="md" pill dark={dark} loading={cancelling} onPress={onCancel}
        label="Cancel recovery"/>
    </Box>
  );
}

/** A guardian approving an inbound recovery request (offchain, gasless). */
export function ApprovalCard({
  pal, dark, wallet, newOwner, onApprove, approving, approved,
}: {
  pal: FormPal; dark: boolean;
  wallet: string; newOwner: string;
  onApprove: () => void; approving: boolean; approved: boolean;
}): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} gap={10} style={{ borderWidth: 1, borderColor: border }}>
      <Text weight="semibold" size="md" color={head}>A friend asked you to help recover their wallet</Text>
      <Text size="xs" color={sub} numberOfLines={1} ellipsizeMode="middle">Wallet: {wallet}</Text>
      <Text size="xs" color={sub} numberOfLines={1} ellipsizeMode="middle">New owner: {newOwner}</Text>
      <Text size="sm" color={sub}>
        Only approve if you trust this is them. Approving is free and only helps rotate their owner key — it never moves their funds.
      </Text>
      <Button variant="primary" size="md" pill dark={dark} disabled={approved} loading={approving}
        onPress={onApprove} label={approved ? 'Approved' : 'Approve recovery'}/>
    </Box>
  );
}
