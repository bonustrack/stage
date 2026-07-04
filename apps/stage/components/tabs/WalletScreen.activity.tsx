
import { useEffect, useState } from 'react';

import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import {
  DANGER_COLOR, SUCCESS_COLOR, txRowModel,
  type TxDirection, type TxRowParams,
} from '@views';
import { Spinner } from '../Spinner';
import { Col, Box, Row } from '../layout';
import { DANGER } from '../../lib/theme';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { fetchActivityAllChains, type ActivityRow } from '../../lib/etherscan';
import { PrivateActivitySection } from './WalletScreen.privateActivity';
import { SoftBadge, WalletIcon } from '../wallet/widgets';
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

const DIR_ICON: Record<TxDirection, string> = {
  in: 'arrow-down',
  out: 'arrow-up',
  self: 'switch-horizontal',
};

function valuePrefix(direction: TxDirection): string {
  if (direction === 'in') return '+';
  if (direction === 'out') return '−';
  return '';
}

function TxRowView(params: TxRowParams): React.ReactElement {
  const scheme = useKitScheme();
  const amountLabel = params.amount === '0'
    ? '—'
    : `${valuePrefix(params.direction)}${params.amount} ${params.token}`;
  const amountColor = params.failed === true
    ? DANGER_COLOR[scheme]
    : params.direction === 'in'
      ? SUCCESS_COLOR[scheme]
      : undefined;
  return (
    <Row align="center" gap={12}>
      <WalletIcon
        name={DIR_ICON[params.direction]}
        color={params.failed === true ? DANGER_COLOR[scheme] : undefined}
        size={16}
      />
      <Col gap={2} flex={1}>
        <Text value={params.title} weight="semibold" color="link" truncate />
        <Row align="center" gap={6} flex={1}>
          {params.chainLabel === undefined ? null : (
            <SoftBadge label={params.chainLabel} color="secondary" />
          )}
          <Caption value={params.counterparty} color="secondary" truncate />
        </Row>
      </Col>
      <Col gap={2} align="end">
        <Text value={amountLabel} weight="semibold" textAlign="end" color={amountColor} />
        <Caption
          value={params.subText ?? params.timestamp}
          color={params.failed === true ? 'danger' : 'secondary'}
          textAlign="end"
        />
      </Col>
    </Row>
  );
}

function TxRow({ r, border }: {
  r: ActivityRow; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  const model = txRowModel({
    direction: r.direction,
    title: txTitle(r),
    partyLabel: txPartyLabel(r),
    timeLabel: relTime(r.timestamp),
    valueEth: r.valueEth,
    chainLabel: r.chainLabel,
    nonce: r.nonce,
    failed: r.failed,
  }, { metaTime: true });
  return (
    <Box padding={{ y: 14 }} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <TxRowView {...model} />
    </Box>
  );
}
