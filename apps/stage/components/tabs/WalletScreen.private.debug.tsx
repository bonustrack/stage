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

function DebugRow({ label, value, fg, head }: {
  label: string; value: string; fg: string; head: string;
}): React.ReactElement {
  return (
    <Row padding={{ y: 2 }} gap={12} justify="between">
      <Text size="xs" color={fg}>{label}</Text>
      <Text weight="semibold" size="xs" color={head} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </Row>
  );
}

export function RailgunDebugPanel({ head, fg, border }: {
  head: string; fg: string; border: string;
}): React.ReactElement {
  const [d, setD] = useState<BalanceDebug>(getBalanceDebug());
  useEffect(() => subscribeBalanceDebug(setD), []);

  const getRows = d.getBalancesRows
    ? `mainnet ${d.getBalancesRows.mainnet} · sepolia ${d.getBalancesRows.sepolia}`
    : '—';

  return (
    <Col padding={{ top: 16 }} margin={{ top: 20 }} gap={4} style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Text weight="semibold" size="xs" color={fg}>
        RAILGUN DEBUG · BALANCE PIPELINE
      </Text>
      <DebugRow label="bridge available" value={String(d.bridgeAvailable)} fg={fg} head={head} />
      <DebugRow label="engine ready" value={d.engineReady == null ? '—' : String(d.engineReady)} fg={fg} head={head} />
      {d.engineError ? <DebugRow label="engine error" value={d.engineError} fg={fg} head={DANGER} /> : null}
      <DebugRow label="refresh phase" value={d.phase} fg={fg} head={head} />
      <DebugRow label="last refresh" value={fmtTime(d.refreshAt)} fg={fg} head={head} />
      {d.refreshError ? <DebugRow label="refresh error" value={d.refreshError} fg={fg} head={DANGER} /> : null}
      <DebugRow label="getBalances rows" value={getRows} fg={fg} head={head} />
      <DebugRow label="balance events" value={String(d.eventCount)} fg={fg} head={head} />
      <DebugRow label="last event at" value={fmtTime(d.lastEventAt)} fg={fg} head={head} />
      <Text size="xs" color={fg} style={{ marginTop: 6 }}>
        last balanceUpdate payload
      </Text>
      <Text size="3xs" color={head} selectable>
        {fmtEvent(d)}
      </Text>
    </Col>
  );
}
