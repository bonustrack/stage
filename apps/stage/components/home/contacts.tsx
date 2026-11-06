import { useMemo } from 'react';
import { isAddress } from 'viem';
import { Eyebrow } from '../Eyebrow';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../chatRow/ChannelRow';
import { shortAddress } from '@stage-labs/client/identity/format';
import { usePersonLookup } from '../../lib/resolveHandle';
import { WITH_MAINNET_ENS } from '@stage-labs/client/identity/personLookup';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { dmLinkOf } from '../../lib/links';
import { homeRows } from './state';
import { uniqueBy } from '@stage-labs/client/collections';
import { Column, PAGE_GUTTER } from '../layout';

function getExistingPeers(): { address: string; convId: string }[] {
  const peers = (homeRows() ?? []).flatMap(({ peerAddress: address, convId }) => (address && convId ? [{ address, convId }] : []));
  return uniqueBy(peers, (p) => p.address.toLowerCase());
}

const NO_MATCH_HINT = 'No matches. Try a username, a full address or a name.eth to start a chat.';

interface ResolvedPeer {
  address: string;
  label: string | null;
}

function useResolvedPeer(q: string, enabled: boolean): ResolvedPeer | null {
  const lookup = usePersonLookup(q, WITH_MAINNET_ENS, enabled);
  return enabled && lookup.kind === 'resolved' ? { address: lookup.address, label: lookup.label } : null;
}

interface Peer {
  address: string;
  convId: string;
}

interface ResultRow {
  address: string;
  convId: string | undefined;
  title: string;
  subtitle: string | undefined;
}

function filterPeers(existing: Peer[], q: string): Peer[] {
  const needle = q.toLowerCase();
  if (!needle) return [];
  return existing.filter((p) => {
    if (p.address.toLowerCase().includes(needle)) return true;
    const n = getPeerName(p.address);
    return !!n && n.toLowerCase().includes(needle);
  });
}

function resolvedRow(resolved: ResolvedPeer): ResultRow {
  const fallback = resolved.label ?? shortAddress(resolved.address);
  return { address: resolved.address, convId: undefined, title: getPeerName(resolved.address) ?? fallback, subtitle: 'Start chat' };
}

function peerRow(p: Peer): ResultRow {
  const name = getPeerName(p.address);
  return {
    address: p.address,
    convId: p.convId,
    title: name ?? shortAddress(p.address),
    subtitle: name ? shortAddress(p.address) : undefined,
  };
}

function openPeer(address: string, convId?: string): void {
  const target = isAddress(address) ? dmLinkOf(address) : { pathname: '/[convId]' as const, params: { convId: convId ?? address } };
  void import('expo-router').then(({ router }) => {
    router.push(target);
  });
}

function ContactRows({ rows, label }: { rows: ResultRow[]; label: string }): React.ReactElement {
  return (
    <Column>
      <Column padding={{ x: PAGE_GUTTER, top: 16, bottom: 6 }}>
        <Eyebrow text={label} color="secondary" fontWeight="semibold" />
      </Column>
      {rows.map((r) => (
        <ChannelRow
          key={`${r.address}-${r.convId ?? ''}`}
          title={r.title}
          avatarAddress={r.address}
          square={false}
          subtitle={r.subtitle ?? null}
          onPress={() => {
            openPeer(r.address, r.convId);
          }}
        />
      ))}
    </Column>
  );
}

export function HomeContactResults({ query, noChannels }: { query: string; noChannels: boolean }): React.ReactElement | null {
  const q = query.trim();
  const existing = useMemo(() => getExistingPeers(), []);
  const filtered = useMemo(() => filterPeers(existing, q), [existing, q]);
  const resolved = useResolvedPeer(q, filtered.length === 0);
  usePeerProfiles([resolved?.address, ...existing.map((p) => p.address)]);

  const extra = resolved && !filtered.some((p) => p.address.toLowerCase() === resolved.address) ? [resolvedRow(resolved)] : [];
  const rows = [...extra, ...filtered.map(peerRow)];
  if (!q) return null;
  if (rows.length === 0) return noChannels ? <EmptyState title={NO_MATCH_HINT} /> : null;
  return <ContactRows rows={rows} label="PEOPLE" />;
}
