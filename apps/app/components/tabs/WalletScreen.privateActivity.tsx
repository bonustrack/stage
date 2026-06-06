/** Private (shielded 0zk) fund-movement section of the Activity tab.
 *
 *  Renders the wallet's private money trail - shields (funds entering the
 *  shielded balance), unshields (funds leaving back to a public address), and
 *  0zk->0zk transfers (private receives + sends) - above the public Etherscan
 *  list. Data comes from lib/railgun/history (fetchPrivateActivity), the SAME
 *  embedded-bridge read path that feeds shielded balances, so it is pure JS /
 *  hot-reloadable.
 *
 *  The section header is ALWAYS visible once the bridge is present, even with
 *  zero rows: it shows a loading line while the engine scans, then either the
 *  rows or a "No private activity yet" empty state. It renders nothing only when
 *  the bridge is absent (web / non-Railgun build).
 *
 *  Visually mirrors the public TxRow (circular direction icon, title over meta,
 *  signed amount) but every row carries a "Private" badge so the shielded nature
 *  is unmistakable, plus a per-kind label (Shield / Unshield / Sent / Received
 *  privately). */

import { useEffect, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Col, Row, Box } from '../layout';
import {
  fetchPrivateActivity,
  type PrivateActivityRow,
} from '../../lib/railgun/history';

type Status = 'loading' | 'ready';

const PRIVATE_GREEN = '#22c55e';

/** Fetch + render the private fund-movement rows. Once the bridge is present the
 *  header always renders, with a loading line, the rows, or an empty state - so
 *  the section is discoverable even before / without any private history. */
export function PrivateActivitySection({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement | null {
  const [rows, setRows] = useState<PrivateActivityRow[]>([]);
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const res = await fetchPrivateActivity();
        if (cancelled) return;
        setAvailable(res.available);
        setRows(res.rows);
      } catch {
        /* best-effort: leave rows empty, header still shows empty state */
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bridge not in this binary (web / non-Railgun build): show nothing at all.
  if (status === 'ready' && !available) return null;

  return (
    <Col>
      <Row align="center" gap={6} style={{ paddingTop: 14, paddingBottom: 4 }}>
        <Icon name="lockClosed" size={13} color={sub} />
        <Text style={{
          color: sub, fontSize: 13, fontFamily: 'Calibre-Semibold',
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>
          Private activity
        </Text>
      </Row>
      {status === 'loading' ? (
        <Text style={{
          color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', paddingVertical: 14,
        }}>
          Loading private activity…
        </Text>
      ) : rows.length === 0 ? (
        <Text style={{
          color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', paddingVertical: 14,
        }}>
          No private activity yet
        </Text>
      ) : (
        rows.map(r => (
          <PrivateTxRow key={r.key} r={r} head={head} sub={sub} border={border} />
        ))
      )}
    </Col>
  );
}

/** Per-kind row label. Shields are always inbound, unshields always outbound;
 *  transfers carry their own direction. */
function rowTitle(r: PrivateActivityRow): string {
  if (r.kind === 'shield') return 'Shielded';
  if (r.kind === 'unshield') return 'Unshielded';
  return r.direction === 'in' ? 'Received privately' : 'Sent privately';
}

/** A single private-movement row. Layout matches the public TxRow: a circular
 *  direction icon, a title over the chain + time meta, and the signed amount
 *  with a "Private" tag. */
function PrivateTxRow({ r, head, sub, border }: {
  r: PrivateActivityRow; head: string; sub: string; border: string;
}): React.ReactElement {
  const prefix = r.direction === 'in' ? '+' : '−';
  const valueColor = r.direction === 'in' ? PRIVATE_GREEN : head;
  return (
    <Row align="center" gap={12} py={14}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Box style={{
        width: 32, height: 32, borderRadius: 999, backgroundColor: border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={r.direction === 'in' ? 'arrowDown' : 'arrowUp'} size={18} color={head} />
      </Box>
      <Col flex={1} style={{ minWidth: 0 }}>
        <Row align="center" gap={6}>
          <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
            {rowTitle(r)}
          </Text>
          <Row align="center" gap={3} style={{
            paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: border,
          }}>
            <Icon name="lockClosed" size={10} color={sub} />
            <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold' }}>
              Private
            </Text>
          </Row>
        </Row>
        <Row align="center" gap={6} style={{ marginTop: 2 }}>
          <Box style={{
            paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: border,
          }}>
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
              {r.chainLabel}
            </Text>
          </Box>
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
            {r.timestamp > 0 ? relTime(r.timestamp) : 'Confirmed'}
          </Text>
        </Row>
      </Col>
      <Col align="end">
        <Text style={{ color: valueColor, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
          {`${prefix}${r.amount} ${r.symbol}`}
        </Text>
      </Col>
    </Row>
  );
}

/** Compact relative time: "3h", "2d", or a date for older transfers. Mirrors
 *  the public Activity row's relTime so both sections read identically. */
function relTime(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
