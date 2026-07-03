
import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Box } from '../layout';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers, WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot, contactRow, emptyState, sectionHeader, CONTACT_PRESS } from '@stage-labs/views';
import { openDmWithAddress, shortAddress } from '../../modules/messaging';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { getCachedRows } from '../../modules/messaging';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';

const NO_MATCH_NODE = basicRoot(
  emptyState({ title: 'No matches. Paste a full address or a name.eth to start a chat.' }),
);

const PEOPLE_HEADER_NODE = basicRoot(sectionHeader({ title: 'People' }));

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
    return <ViewHost node={NO_MATCH_NODE} />;
  }

  const rows = [
    ...(showResolved
      ? [{
          address: resolved.address,
          convId: undefined,
          title: getPeerName(resolved.address) ?? (resolved.source === 'ens' ? q : shortAddress(resolved.address)),
          subtitle: 'Start chat',
        }]
      : []),
    ...filtered.map(p => ({
      address: p.address,
      convId: p.convId,
      title: getPeerName(p.address) ?? shortAddress(p.address),
      subtitle: getPeerName(p.address) ? shortAddress(p.address) : undefined,
    })),
  ];

  const listNode: WidgetRoot = {
    type: 'ListView',
    children: rows.map(r =>
      contactRow({
        name: r.title,
        avatarUri: stampAvatarUrl(r.address, 80),
        handle: r.subtitle,
        payload: { address: r.address, convId: r.convId ?? '' },
      }),
    ),
  };

  const actions: PayloadHandlers = {
    [CONTACT_PRESS]: (payload) => {
      const address = payload.address;
      const convId = payload.convId;
      if (typeof address === 'string') {
        open(address, typeof convId === 'string' && convId !== '' ? convId : undefined);
      }
    },
  };

  return (
    <Box>
      <Box padding={{ x: 16, top: 16, bottom: 6 }}>
        <ViewHost node={PEOPLE_HEADER_NODE} />
      </Box>
      <ViewHost node={listNode} actions={actions} />
    </Box>
  );
}
