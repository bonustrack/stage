
import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Box, PAGE_GUTTER } from '../layout';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../ChannelRow';
import { shortAddress } from '../../modules/messaging';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { peopleLookup } from './contacts.model';
import { homeRows } from './state';

function getExistingPeers(): { address: string; convId: string }[] {
  const seen = new Set<string>();
  const peers: { address: string; convId: string }[] = [];
  for (const { peerAddress: a, convId: cid } of homeRows() ?? []) {
    if (!a || !cid) continue;
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    peers.push({ address: a, convId: cid });
  }
  return peers;
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

function filterPeers(existing: Peer[], q: string, showAllWhenEmpty: boolean): Peer[] {
  const needle = q.toLowerCase();
  if (!needle) return showAllWhenEmpty ? existing : [];
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

function ContactRows({ rows, label, onOpen }: { rows: ResultRow[]; label: string; onOpen?: () => void }): React.ReactElement {
  return (
    <Box>
      <Box padding={{ x: PAGE_GUTTER, top: 16, bottom: 6 }}>
        <Caption value={label} color="secondary" weight="semibold" />
      </Box>
      {rows.map((r) => (
        <ChannelRow
          key={`${r.address}-${r.convId ?? ''}`}
          title={r.title}
          avatarAddress={r.address}
          square={false}
          subtitle={r.subtitle ?? null}
          onPress={() => { onOpen?.(); openPeer(r.address, r.convId); }}
        />
      ))}
    </Box>
  );
}

export function HomeContactResults(
  { query, noChannels, showAllWhenEmpty = false, onOpen }: {
    query: string; noChannels: boolean; showAllWhenEmpty?: boolean; onOpen?: () => void;
  },
): React.ReactElement | null {
  const q = query.trim();
  const existing = useMemo(() => getExistingPeers(), []);
  const filtered = useMemo(() => filterPeers(existing, q, showAllWhenEmpty), [existing, q, showAllWhenEmpty]);
  const resolved = useResolvedPeer(q, filtered.length === 0);
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  const extra = resolved && !filtered.some(p => p.address.toLowerCase() === resolved.address) ? [resolvedRow(resolved)] : [];
  const rows = [...extra, ...filtered.map(peerRow)];
  if (!q && !showAllWhenEmpty) return null;
  if (rows.length === 0) return noChannels ? <EmptyState title={NO_MATCH_HINT} /> : null;
  return <ContactRows rows={rows} label={q ? 'PEOPLE' : 'CONTACTS'} onOpen={onOpen} />;
}
