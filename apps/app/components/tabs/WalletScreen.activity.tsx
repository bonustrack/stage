
import { useEffect, useMemo, useState } from 'react';

import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { BasicNode } from '@stage-labs/kit/kit';
import { txRow, type TxDirection } from '@stage-labs/views';
import { Spinner } from '../Spinner';
import { Col, Box } from '../layout';
import { DANGER } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { fetchActivityAllChains, type ActivityRow } from '../../lib/etherscan';
import { PrivateActivitySection } from './WalletScreen.privateActivity';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function ActivityView({ address, head, sub, border, bg }: {
  address?: string; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setStatus('loading');
    void (async (): Promise<void> => {
      try {
        const list = await fetchActivityAllChains(address, 50);
        if (cancelled) return;
        setRows(list);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  usePeerProfiles(rows.map(r => r.counterparty));

  const priv = <PrivateActivitySection head={head} sub={sub} border={border} bg={bg} />;

  if (status === 'error') {
    return (
      <Col margin={{ x: 16 }}>
        {priv}
        <Col padding={{ y: 40 }} align="center">
          <Text size="md" color={DANGER}>
            Couldn’t load activity
          </Text>
        </Col>
      </Col>
    );
  }
  if (status === 'loading' || status === 'idle') {
    return (
      <Col margin={{ x: 16 }}>
        {priv}
        <Col padding={{ y: 40 }} align="center">
          <Spinner size={28} color={head}/>
        </Col>
      </Col>
    );
  }
  if (rows.length === 0) {
    return (
      <Col margin={{ x: 16 }}>
        {priv}
        <Col padding={{ y: 40 }} align="center">
          <Text size="md" role="secondary">
            No transactions yet
          </Text>
        </Col>
      </Col>
    );
  }
  return (
    <Col margin={{ x: 16 }}>
      {priv}
      {rows.map(r => (
        <TxRow key={r.hash} r={r} head={head} sub={sub} border={border} bg={bg}/>
      ))}
    </Col>
  );
}

const DIR_MAP: Record<ActivityRow['direction'], TxDirection> = {
  send: 'out', receive: 'in', self: 'self',
};

function txTitle(r: ActivityRow): string {
  if (r.isContract) return r.functionName || 'Contract';
  if (r.direction === 'receive') return 'Received';
  if (r.direction === 'self') return 'Self';
  return 'Sent';
}

function txRowNode(r: ActivityRow): BasicNode {
  const name = getPeerName(r.counterparty) ?? shortAddress(r.counterparty);
  const partyLabel = r.direction === 'receive' ? `From ${name}` : `To ${name}`;
  return {
    type: 'Basic',
    children: [
      txRow({
        direction: DIR_MAP[r.direction],
        title: txTitle(r),
        amount: r.valueEth,
        token: 'ETH',
        timestamp: `${partyLabel} · ${relTime(r.timestamp)}`,
        counterparty: `${partyLabel} · ${relTime(r.timestamp)}`,
        chainLabel: r.chainLabel,
        subText: r.failed ? 'Failed' : `#${r.nonce}`,
        failed: r.failed,
      }),
    ],
  };
}

function TxRow({ r, border }: {
  r: ActivityRow; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  const node = useMemo(() => txRowNode(r), [r]);
  return (
    <Box padding={{ y: 14 }} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <KitRenderer node={node} />
    </Box>
  );
}

function relTime(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
