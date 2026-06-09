/** Activity tab — the connected wallet's recent Ethereum-mainnet transactions,
 *  ordered nonce-desc (newest first) via Etherscan v2 `txlist?sort=desc`. Each
 *  tx is one row: a direction icon, the decoded action + counterparty (resolved
 *  Snapshot name when known, else shortened address), the relative time, and the
 *  signed ETH value. Mirrors the data-hook + row patterns of the Tokens tab.
 *
 *  Scope: Ethereum mainnet + Sepolia, fetched in parallel and merged
 *  newest-first. Each row carries a small chain badge ("Ethereum"/"Sepolia").
 *  A chain that errors or has no history is skipped; empty only when BOTH
 *  chains return nothing. */

import { useEffect, useState } from 'react';

import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Spinner } from '../Spinner';
import { Col, Row, Box } from '../layout';
import { DANGER } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { fetchActivityAllChains, type ActivityRow } from '../../lib/etherscan';
import { PrivateActivitySection } from './WalletScreen.privateActivity';

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

  // Pre-resolve the counterparties' Snapshot names for nicer rows.
  usePeerProfiles(rows.map(r => r.counterparty));

  // The private (shielded 0zk) transfer section paints independently of the
  // public Etherscan fetch: it always renders above the public list when it has
  // rows, so a wallet with only private history still shows something.
  const priv = <PrivateActivitySection head={head} sub={sub} border={border} bg={bg} />;

  if (status === 'error') {
    return (
      <Col mx={16}>
        {priv}
        <Col py={40} align="center">
          <Text size="md" color={DANGER}>
            Couldn’t load activity
          </Text>
        </Col>
      </Col>
    );
  }
  if (status === 'loading' || status === 'idle') {
    return (
      <Col mx={16}>
        {priv}
        <Col py={40} align="center">
          <Spinner size={28} color={head} />
        </Col>
      </Col>
    );
  }
  if (rows.length === 0) {
    return (
      <Col mx={16}>
        {priv}
        <Col py={40} align="center">
          <Text size="md" color={sub}>
            No transactions yet
          </Text>
        </Col>
      </Col>
    );
  }
  return (
    <Col mx={16}>
      {priv}
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
        <Text weight="semibold" size="xl" color={head} numberOfLines={1}>
          {title}
        </Text>
        <Row align="center" gap={6} style={{ marginTop: 2 }}>
          <Box style={{
            paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
            backgroundColor: border,
          }}>
            <Text size="xs" color={sub} numberOfLines={1}>
              {r.chainLabel}
            </Text>
          </Box>
          <Text size="md" color={sub} style={{ flex: 1 }} numberOfLines={1}>
            {`${partyLabel} · ${relTime(r.timestamp)}`}
          </Text>
        </Row>
      </Col>
      <Col align="end">
        <Text weight="semibold" size="xl" color={valueColor}>
          {r.valueEth === '0' ? '—' : `${prefix}${r.valueEth} ETH`}
        </Text>
        <Text size="md" color={r.failed ? DANGER : sub} style={{ marginTop: 2 }}>
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
