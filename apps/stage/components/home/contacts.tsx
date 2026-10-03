
import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Eyebrow } from '../Eyebrow';
import { Box, PAGE_GUTTER } from '../layout';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../ChannelRow';
import { shortAddress } from '@stage-labs/client/identity/format';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { peopleLookup } from './contacts.model';
import { homeRows } from './state';
import { uniqueBy } from '@stage-labs/client/collections';

function getExistingPeers(): { address: string; convId: string }[] {
  const peers = (homeRows() ?? []).flatMap(({ peerAddress: address, convId }) => (address && convId ? [{ address, convId }] : []));
  return uniqueBy(peers, p => p.address.toLowerCase());
}

const LOOKUP_DEBOUNCE_MS = 300;
const NO_MATCH_HINT = 'No matches. Try a username, a full address or a name.eth to start a chat.';

interface ResolvedPeer { address: string; title: string }

function useResolvedPeer(q: string, enabled: boolean): ResolvedPeer | null {
  const [resolved, setResolved] = useState<ResolvedPeer | null>(null);
  const lookup = useMemo(() => (enabled ? peopleLookup(q) : null), [q, enabled]);
  useEffect(() => {
    if (!lookup) { setResolved(null); return; }
    if (isAddress(lookup.handle)) { setResolved({ address: lookup.handle, title: lookup.title }); return; }
    let cancelled = false;
    setResolved(null);
    const t = setTimeout(() => {
      void resolveHandleToAddress(lookup.handle).then((addr) => {
        if (!cancelled && addr) setResolved({ address: addr.toLowerCase(), title: lookup.title });
      });
    }, LOOKUP_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [lookup?.handle, enabled]);
  return resolved;
}

interface Peer { address: string; convId: string }

interface ResultRow { address: string; convId: string | undefined; title: string; subtitle: string | undefined }

function filterPeers(existing: Peer[], q: string): Peer[] {
  const needle = q.toLowerCase();
  if (!needle) return [];
  return existing.filter(p => {
    if (p.address.toLowerCase().includes(needle)) return true;
    const n = getPeerName(p.address);
    return !!n && n.toLowerCase().includes(needle);
  });
}

function resolvedRow(resolved: ResolvedPeer): ResultRow {
  const fallback = resolved.title === '' ? shortAddress(resolved.address) : resolved.title;
  return { address: resolved.address, convId: undefined, title: getPeerName(resolved.address) ?? fallback, subtitle: 'Start chat' };
}

function peerRow(p: Peer): ResultRow {
  const name = getPeerName(p.address);
  return { address: p.address, convId: p.convId, title: name ?? shortAddress(p.address), subtitle: name ? shortAddress(p.address) : undefined };
}

function openPeer(address: string, convId?: string): void {
  const target = isAddress(address) ? address : (convId ?? address);
  void import('expo-router').then(({ router }) => {
    router.push({ pathname: '/[convId]', params: { convId: target } });
  });
}

function ContactRows({ rows, label }: { rows: ResultRow[]; label: string }): React.ReactElement {
  return (
    <Box>
      <Box padding={{ x: PAGE_GUTTER, top: 16, bottom: 6 }}>
        <Eyebrow value={label} color="secondary" weight="semibold"/>
      </Box>
      {rows.map((r) => (
        <ChannelRow
          key={`${r.address}-${r.convId ?? ''}`}
          title={r.title}
          avatarAddress={r.address}
          square={false}
          subtitle={r.subtitle ?? null}
          onPress={() => { openPeer(r.address, r.convId); }}
        />
      ))}
    </Box>
  );
}

export function HomeContactResults({ query, noChannels }: { query: string; noChannels: boolean }): React.ReactElement | null {
  const q = query.trim();
  const existing = useMemo(() => getExistingPeers(), []);
  const filtered = useMemo(() => filterPeers(existing, q), [existing, q]);
  const resolved = useResolvedPeer(q, filtered.length === 0);
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  const extra = resolved && !filtered.some(p => p.address.toLowerCase() === resolved.address) ? [resolvedRow(resolved)] : [];
  const rows = [...extra, ...filtered.map(peerRow)];
  if (!q) return null;
  if (rows.length === 0) return noChannels ? <EmptyState title={NO_MATCH_HINT} /> : null;
  return <ContactRows rows={rows} label="PEOPLE" />;
}
