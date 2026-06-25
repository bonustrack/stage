
import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Box } from '../layout';
import { ChannelRow } from '../ChannelRow';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type { WidgetRoot } from '@stage-labs/kit/chatkit';
import { emptyState, sectionHeader } from '@stage-labs/views';
import { openDmWithAddress, shortAddress } from '../../modules/messaging';
import { resolveEnsName } from '../../lib/ens';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { getCachedRows } from '../../modules/messaging';

const NO_MATCH_NODE: WidgetRoot = {
  type: 'Basic',
  children: [
    emptyState({ title: 'No matches. Paste a full address or a name.eth to start a chat.' }),
  ],
};

const PEOPLE_HEADER_NODE: WidgetRoot = {
  type: 'Basic',
  children: [sectionHeader({ title: 'People' })],
};

function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(s.trim());
}

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

export function HomeContactResults(
  { query, noChannels }: { query: string; c: Colors; noChannels: boolean },
): React.ReactElement | null {
  const q = query.trim();
  const [resolved, setResolved] = useState<{ address: string; source: 'address' | 'ens' } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const existing = useMemo(() => getExistingPeers(), []);
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

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
        } catch { }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

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
      } catch { } finally { setOpening(null); }
    })();
  };

  const showResolved = resolved && !filtered.some(p => p.address.toLowerCase() === resolved.address);
  if (!q) return null;
  if (!showResolved && filtered.length === 0) {
    if (!noChannels) return null;
    return <ChatKitRenderer node={NO_MATCH_NODE} />;
  }

  return (
    <Box>
      <Box padding={{ x: 16, top: 16, bottom: 6 }}>
        <ChatKitRenderer node={PEOPLE_HEADER_NODE} />
      </Box>
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
