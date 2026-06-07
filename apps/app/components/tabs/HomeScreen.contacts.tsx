/** Contact search for the Home screen.
 *
 *  The unified Home search input drives BOTH the channel-list filter (see
 *  HomeScreen.search) AND this contacts block: when the query is non-empty we
 *  surface people results below the filtered channels. This brings the
 *  contact-search behaviour from the former standalone /search page onto Home:
 *
 *   - ADDRESS / ENS: a full address (or an ENS-style `name.eth`, resolved via
 *     resolveEnsName) yields a "start a chat" result that opens/creates a DM.
 *   - EXISTING CONTACTS: cached DM peers whose name or address matches the query.
 *
 *  Tapping any row opens or creates the DM and pushes `/xmtp/[convId]`. Styling
 *  mirrors the old search page (Avatar + name + short address rows). */

import { useEffect, useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from '../layout';
import { openDmWithAddress, shortAddress } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { ContactRow, getExistingPeers, looksLikeEns } from './HomeScreen.contacts.row';

interface Colors { fg: string; head: string; sub: string; border: string }

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
    /** Nothing matched here — only show a combined "No matches" line when the
     *  channel list also came up empty (so it isn't shown beside channel hits). */
    if (!noChannels) return null;
    return (
      <Text style={{ color: c.sub, fontSize: 13, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
        No matches. Paste a full address or a {'name.eth'} to start a chat.
      </Text>
    );
  }

  return (
    <Box>
      <Text style={{ color: c.sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
        PEOPLE
      </Text>
      {showResolved ? (
        <ContactRow
          address={resolved.address}
          title={getPeerName(resolved.address) ?? (resolved.source === 'ens' ? q : shortAddress(resolved.address))}
          opening={opening === resolved.address.toLowerCase()}
          trailing={<Icon name="chatRect" size={18} color={c.fg} />}
          onPress={() => open(resolved.address)}
          c={c}
        />
      ) : null}
      {filtered.map(p => (
        <ContactRow
          key={p.address.toLowerCase()}
          address={p.address}
          title={getPeerName(p.address) ?? shortAddress(p.address)}
          opening={opening === p.address.toLowerCase()}
          onPress={() => open(p.address, p.convId)}
          c={c}
        />
      ))}
    </Box>
  );
}
