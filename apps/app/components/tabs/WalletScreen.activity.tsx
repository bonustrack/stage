/** Activity tab — the connected wallet's recent Ethereum-mainnet transactions,
 *  ordered nonce-desc (newest first) via Etherscan v2 `txlist?sort=desc`. Each
 *  tx is one row: a direction icon, the decoded action + counterparty (resolved
 *  Snapshot name when known, else shortened address), the relative time, and the
 *  signed ETH value. Mirrors the data-hook + row patterns of the Tokens tab.
 *
 *  Scope (v1): mainnet only — the wallet also tracks Sepolia, but day-to-day
 *  activity lives on mainnet; multi-chain merge is a later step. */

import { useEffect, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Spinner } from '../Spinner';
import { Col, Row, Box } from '../layout';
import { DANGER } from '../../lib/theme';
import { shortAddress } from '../../lib/xmtp.types';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { fetchActivity, type ActivityRow } from '../../lib/etherscan';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** Mainnet activity, fetched once per address and cached on the address ref. */
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
        const list = await fetchActivity(address, 1, 50);
        if (cancelled) return;
        setRows(list);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  // Pre-resolve the counterparties' Snapshot names for nicer rows.
  usePeerProfiles(rows.map(r => r.counterparty));

  if (status === 'error') {
    return (
      <Col mx={16} py={40} align="center">
        <Text style={{ color: DANGER, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
          Couldn’t load activity
        </Text>
      </Col>
    );
  }
  if (status === 'loading' || status === 'idle') {
    return (
      <Col mx={16} py={40} align="center">
        <Spinner size={28} color={head} />
      </Col>
    );
  }
  if (rows.length === 0) {
    return (
      <Col mx={16} py={40} align="center">
        <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
          No transactions yet
        </Text>
      </Col>
    );
  }
  return (
    <Col mx={16}>
      {rows.map(r => (
        <TxRow key={r.hash} r={r} head={head} sub={sub} border={border} bg={bg} />
      ))}
    </Col>
  );
}

const DIR_ICON: Record<ActivityRow['direction'], HeroIconName> = {
  send: 'arrowUp', receive: 'arrowDown', self: 'switchHorizontal',
};

/** A single transaction row — 4-corner layout matching TokenRow: a circular
 *  direction icon, the action title over counterparty + time, and the signed
 *  ETH value over the tx status. */
function TxRow({ r, head, sub, border, bg }: {
  r: ActivityRow; head: string; sub: string; border: string; bg: string;
}): React.ReactElement {
  void bg;
  const name = getPeerName(r.counterparty) ?? shortAddress(r.counterparty);
  const title = r.isContract
    ? (r.functionName || 'Contract')
    : r.direction === 'receive' ? 'Received' : r.direction === 'self' ? 'Self' : 'Sent';
  const prefix = r.direction === 'receive' ? '+' : r.direction === 'send' ? '−' : '';
  const valueColor = r.failed ? DANGER : r.direction === 'receive' ? '#22c55e' : head;
  const partyLabel = r.direction === 'receive' ? `From ${name}` : `To ${name}`;
  return (
    <Row align="center" gap={12} py={14}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Box style={{
        width: 32, height: 32, borderRadius: 999, backgroundColor: border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={DIR_ICON[r.direction]} size={18} color={r.failed ? DANGER : head} />
      </Box>
      <Col flex={1} style={{ minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
          {`${partyLabel} · ${relTime(r.timestamp)}`}
        </Text>
      </Col>
      <Col align="end">
        <Text style={{ color: valueColor, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
          {r.valueEth === '0' ? '—' : `${prefix}${r.valueEth} ETH`}
        </Text>
        <Text style={{ color: r.failed ? DANGER : sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          {r.failed ? 'Failed' : `#${r.nonce}`}
        </Text>
      </Col>
    </Row>
  );
}

/** Compact relative time: "3h", "2d", or a date for older txs. */
function relTime(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
