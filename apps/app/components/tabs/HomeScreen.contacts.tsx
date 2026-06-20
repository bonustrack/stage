/** @file HomeScreen.contacts — contact-search results below the filtered channels when the search query is non-empty: address/ENS "start a chat" rows plus matching cached DM peers, opening a DM on tap. */

import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../layout';
import { ChannelRow } from '../ChannelRow';
import { openDmWithAddress, shortAddress } from '../../modules/messaging';
import { resolveEnsName } from '../../lib/ens';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { getCachedRows } from '../../modules/messaging';

/** Cheap pre-flight - accept any `*.eth` (single or multi-label) as resolvable. */
function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(s.trim());
}

/** Existing DM peers (address-keyed) pulled from the cached channels list. */
function getExistingPeers(): { address: string; convId: string }[] {
  const rows = getCachedRows() ?? [];
  const seen = new Set<string>();
  const peers: { address: string; convId: string }[] = [];
  for (const r of rows) {
    const a = (r as { peerAddress?: string | null; convId?: string }).peerAddress;
    const cid = (r as { peerAddress?: string | null; convId?: string }).convId;
    if (!a || !cid) continue;
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    peers.push({ address: a, convId: cid });
  }
  return peers;
}

interface Colors { fg: string; head: string; sub: string; border: string }

/** Renders contact search results on the home screen, or nothing when the query is empty. */
export function HomeContactResults(
  { query, c, noChannels }: { query: string; c: Colors; noChannels: boolean },
): React.ReactElement | null {
  const q = query.trim();
  const [resolved, setResolved] = useState<{ address: string; source: 'address' | 'ens' } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  /** Existing DM peers (address-keyed) pulled from the cached channels list. */
  const existing = useMemo(() => getExistingPeers(), []);
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  /** Address / ENS resolution → a "start a chat" result. Debounced for names. */
  useEffect(() => {
    const needle = q.toLowerCase();
    if (!needle) { setResolved(null); return; }
    if (isAddress(needle)) { setResolved({ address: needle, source: 'address' }); return; }
    if (!looksLikeEns(needle)) { setResolved(null); return; }
    let cancelled = false;
    setResolved(null);
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const addr = await resolveEnsName(needle);
          if (!cancelled && addr) setResolved({ address: addr.toLowerCase(), source: 'ens' });
        } catch { /* no resolved result */ }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  /** Existing contacts filtered by the query (name or address substring). */
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return existing.filter(p => {
      if (p.address.toLowerCase().includes(needle)) return true;
      const n = getPeerName(p.address);
      return !!n && n.toLowerCase().includes(needle);
    });
  }, [existing, q]);

  /** Open helper. */
  const open = (address: string, convId?: string): void => {
    if (opening) return;
    const key = address.toLowerCase();
    setOpening(key);
    void (async (): Promise<void> => {
      try {
        const { router } = await import('expo-router');
        const id = convId ?? await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId: id } });
      } catch { /* swallow */ } finally { setOpening(null); }
    })();
  };

  /** Don't surface a resolved address that's already an existing contact. */
  const showResolved = resolved && !filtered.some(p => p.address.toLowerCase() === resolved.address);
  if (!q) return null;
  if (!showResolved && filtered.length === 0) {
    /** Nothing matched here - only show a combined "No matches" line when the channel list also came up empty (so it isn't shown beside channel hits). */
    if (!noChannels) return null;
    return (
      <Text size="xs" color={c.sub} style={{ textAlign: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
        No matches. Paste a full address or a {'name.eth'} to start a chat.
      </Text>
    );
  }

  return (
    <Box>
      <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
        PEOPLE
      </Text>
      {showResolved ? (
        <ChannelRow
          title={getPeerName(resolved.address) ?? (resolved.source === 'ens' ? q : shortAddress(resolved.address))}
          avatarAddress={resolved.address}
          square={false}
          subtitle="Start chat"
          onPress={() => { open(resolved.address); }}
        />
      ) : null}
      {filtered.map(p => (
        <ChannelRow
          key={p.address.toLowerCase()}
          title={getPeerName(p.address) ?? shortAddress(p.address)}
          avatarAddress={p.address}
          square={false}
          subtitle={getPeerName(p.address) ? shortAddress(p.address) : null}
          onPress={() => { open(p.address, p.convId); }}
        />
      ))}
    </Box>
  );
}
