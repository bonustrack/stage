/**
 * @file Private (shielded 0zk) fund-movement section of the Activity tab, fetching and rendering shield/unshield/0zk-transfer rows with a "Private" badge above the public Etherscan list.
 */

import { useEffect, useState } from 'react';

import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Col, Row, Box } from '../layout';
import { TokenAvatar } from './WalletScreen.tokenAvatar';
import {
  fetchPrivateActivity,
  type PrivateActivityRow,
} from '../../lib/railgun/history';

/** The shield-check glyph the app already uses to mark Railgun-shielded tokens (see WalletScreen.parts PrivateBadge). Overlaid on each activity row's token avatar so a private/Railgun tx is unmistakable. */
const SHIELD_ICON: HeroIconName = 'shieldCheck';

type Status = 'loading' | 'ready';

const PRIVATE_GREEN = '#22c55e';

/** Fetch + render the private fund-movement rows. Once the bridge is present the header always renders, with a loading line, the rows, or an empty state - so the section is discoverable even before / without any private history. */
export function PrivateActivitySection({ head, sub, border, bg }: {
  head: string; sub: string; border: string; bg: string;
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
      <Row padding={{ top: 14, bottom: 4 }} align="center" gap={6}>
        <Icon name="lockClosed" size={13} color={sub}/>
        <Text weight="semibold" size="xs" color={sub} style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Private activity
        </Text>
      </Row>
      {status === 'loading' ? (
        <Text size="md" color={sub} style={{ paddingVertical: 14 }}>
          Loading private activity…
        </Text>
      ) : rows.length === 0 ? (
        <Text size="md" color={sub} style={{ paddingVertical: 14 }}>
          No private activity yet
        </Text>
      ) : (
        rows.map(r => (
          <PrivateTxRow key={r.key} r={r} head={head} sub={sub} border={border} bg={bg}/>
        ))
      )}
    </Col>
  );
}

/** Per-kind row label. Shields are always inbound, unshields always outbound; transfers carry their own direction. */
function rowTitle(r: PrivateActivityRow): string {
  if (r.kind === 'shield') return 'Shielded';
  if (r.kind === 'unshield') return 'Unshielded';
  return r.direction === 'in' ? 'Received privately' : 'Sent privately';
}

/** A single private-movement row. Layout matches the public TxRow: a circular direction icon, a title over the chain + time meta, and the signed amount with a "Private" tag. */
function PrivateTxRow({ r, head, sub, border, bg }: {
  r: PrivateActivityRow; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  const prefix = r.direction === 'in' ? '+' : '−';
  const valueColor = r.direction === 'in' ? PRIVATE_GREEN : head;
  return (
    <Row padding={{ y: 14 }} align="center" gap={12} 
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {/* Token + network image, identical to the wallet token rows, with the
          Railgun shield glyph overlaid so the tx is unmistakably private. */}
      <TokenAvatar
        logoUrl={r.logoUrl}
        chainId={r.chainId}
        bg={bg}
        border={border}
        badge={<Icon name={SHIELD_ICON} size={11} color={sub} />}
/>
      <Col minWidth={0} flex={1}>
        <Row align="center" gap={6}>
          <Text weight="semibold" size="xl" color={head} numberOfLines={1}>
            {rowTitle(r)}
          </Text>
          <Row radius="xs" background={border} padding={{ x: 6, y: 1 }} align="center" gap={3}>
            <Icon name={SHIELD_ICON} size={10} color={sub}/>
            <Text weight="semibold" size="3xs" color={sub}>
              Private
            </Text>
          </Row>
        </Row>
        <Row margin={{ top: 2 }} align="center" gap={6}>
          <Box radius="xs" background={border} padding={{ x: 6, y: 1 }}>
            <Text size="xs" color={sub} numberOfLines={1}>
              {r.chainLabel}
            </Text>
          </Box>
          <Text size="md" color={sub} style={{ flex: 1 }} numberOfLines={1}>
            {r.timestamp> 0 ? relTime(r.timestamp) : 'Confirmed'}
          </Text>
        </Row>
      </Col>
      <Col align="end">
        <Text weight="semibold" size="xl" color={valueColor}>
          {`${prefix}${r.amount} ${r.symbol}`}
        </Text>
      </Col>
    </Row>
  );
}

/** Compact relative time: "3h", "2d", or a date for older transfers. Mirrors the public Activity row's relTime so both sections read identically. */
function relTime(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
