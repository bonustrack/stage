
import { useEffect, useMemo, useState } from 'react';

import { Text } from '@stage-labs/kit/react-native/text';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { BasicNode } from '@stage-labs/kit/kit';
import { basicRoot, txRow, txRowModel } from '@stage-labs/views';
import { Spinner } from '../Spinner';
import { Col, Box } from '../layout';
import { DANGER } from '../../lib/theme';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { fetchActivityAllChains, type ActivityRow } from '../../lib/etherscan';
import { PrivateActivitySection } from './WalletScreen.privateActivity';
import { relTime, txPartyLabel, txTitle } from '@stage-labs/client/wallet/activityFormat';

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

function txRowNode(r: ActivityRow): BasicNode {
  return basicRoot(txRow(txRowModel({
    direction: r.direction,
    title: txTitle(r),
    partyLabel: txPartyLabel(r),
    timeLabel: relTime(r.timestamp),
    valueEth: r.valueEth,
    chainLabel: r.chainLabel,
    nonce: r.nonce,
    failed: r.failed,
  }, { metaTime: true })));
}

function TxRow({ r, border }: {
  r: ActivityRow; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  const node = useMemo(() => txRowNode(r), [r]);
  return (
    <Box padding={{ y: 14 }} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <ViewHost node={node} />
    </Box>
  );
}
