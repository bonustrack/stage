import { useEffect, useState } from 'react';

import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row } from '../layout';
import { DANGER } from '../../lib/theme';
import {
  getBalanceDebug,
  subscribeBalanceDebug,
  type BalanceDebug,
} from '../../lib/railgun/balanceDebug';

const fmtTime = (t: number | null): string => (t ? new Date(t).toLocaleTimeString() : '—');

function fmtEvent(d: BalanceDebug): string {
  if (d.lastEvent == null) return 'none received yet';
  try {
    const s = JSON.stringify(d.lastEvent);
    return s.length> 600 ? `${s.slice(0, 600)}…` : s;
  } catch {
    return '[unserializable event]';
  }
}

function DebugRow({ label, value, sub, head }: {
  label: string; value: string; sub: string; head: string;
}): React.ReactElement {
  return (
    <Row padding={{ y: 2 }} gap={12} justify="between">
      <Text size="xs" color={sub}>{label}</Text>
      <Text weight="semibold" size="xs" color={head} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </Row>
  );
}

export function RailgunDebugPanel({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement {
  const [d, setD] = useState<BalanceDebug>(getBalanceDebug());
  useEffect(() => subscribeBalanceDebug(setD), []);

  const getRows = d.getBalancesRows
    ? `mainnet ${d.getBalancesRows.mainnet} · sepolia ${d.getBalancesRows.sepolia}`
    : '—';

  return (
    <Col padding={{ top: 16 }} margin={{ top: 20 }} gap={4} style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Text weight="semibold" size="xs" color={sub}>
        RAILGUN DEBUG · BALANCE PIPELINE
      </Text>
      <DebugRow label="bridge available" value={String(d.bridgeAvailable)} sub={sub} head={head} />
      <DebugRow label="engine ready" value={d.engineReady == null ? '—' : String(d.engineReady)} sub={sub} head={head} />
      {d.engineError ? <DebugRow label="engine error" value={d.engineError} sub={sub} head={DANGER} /> : null}
      <DebugRow label="refresh phase" value={d.phase} sub={sub} head={head} />
      <DebugRow label="last refresh" value={fmtTime(d.refreshAt)} sub={sub} head={head} />
      {d.refreshError ? <DebugRow label="refresh error" value={d.refreshError} sub={sub} head={DANGER} /> : null}
      <DebugRow label="getBalances rows" value={getRows} sub={sub} head={head} />
      <DebugRow label="balance events" value={String(d.eventCount)} sub={sub} head={head} />
      <DebugRow label="last event at" value={fmtTime(d.lastEventAt)} sub={sub} head={head} />
      <Text size="xs" color={sub} style={{ marginTop: 6 }}>
        last balanceUpdate payload
      </Text>
      <Text size="3xs" color={head} selectable>
        {fmtEvent(d)}
      </Text>
    </Col>
  );
}
