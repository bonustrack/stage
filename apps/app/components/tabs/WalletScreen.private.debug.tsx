/** On-screen "Railgun debug" panel for the shielded-balance pipeline.
 *
 *  We have no adb on-device, so this renders the raw truth of the balance flow
 *  so the user can screenshot it: bridge/engine readiness, the refresh phase +
 *  error, the initial getBalances row counts, and — the key signal — the RAW
 *  last `event:balanceUpdate` payload the engine emitted. If "balance events: 0"
 *  the engine emitted NOTHING (scan/RPC/merkle problem, engine-side). If it
 *  shows rows but the tab reads 0, it's an RN-side sum/store/decimals bug.
 *
 *  Clearly labeled + diagnostic; subscribes to the in-memory balanceDebug store. */
import { useEffect, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Col, Row } from '../layout';
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
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  } catch {
    return String(d.lastEvent);
  }
}

function DebugRow({ label, value, sub, head }: {
  label: string; value: string; sub: string; head: string;
}): React.ReactElement {
  return (
    <Row gap={12} py={2} style={{ justifyContent: 'space-between' }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      <Text style={{ color: head, fontSize: 12, fontFamily: 'Calibre-Semibold', flexShrink: 1, textAlign: 'right' }}>
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
    <Col mt={20} pt={16} gap={4} style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Semibold' }}>
        RAILGUN DEBUG · BALANCE PIPELINE
      </Text>
      <DebugRow label="bridge available" value={String(d.bridgeAvailable)} sub={sub} head={head} />
      <DebugRow label="engine ready" value={d.engineReady == null ? '—' : String(d.engineReady)} sub={sub} head={head} />
      {d.engineError ? <DebugRow label="engine error" value={d.engineError} sub={sub} head="#ff5c5c" /> : null}
      <DebugRow label="refresh phase" value={d.phase} sub={sub} head={head} />
      <DebugRow label="last refresh" value={fmtTime(d.refreshAt)} sub={sub} head={head} />
      {d.refreshError ? <DebugRow label="refresh error" value={d.refreshError} sub={sub} head="#ff5c5c" /> : null}
      <DebugRow label="getBalances rows" value={getRows} sub={sub} head={head} />
      <DebugRow label="balance events" value={String(d.eventCount)} sub={sub} head={head} />
      <DebugRow label="last event at" value={fmtTime(d.lastEventAt)} sub={sub} head={head} />
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 6 }}>
        last balanceUpdate payload
      </Text>
      <Text style={{ color: head, fontSize: 11, fontFamily: 'Calibre-Medium' }} selectable>
        {fmtEvent(d)}
      </Text>
    </Col>
  );
}
