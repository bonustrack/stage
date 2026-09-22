
import { useEffect, useMemo, useState } from 'react';

import { isAddress } from 'viem';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Box, Row, Col } from '../layout';
import { EmptyState } from '../chrome/EmptyState';
import { shortAddress } from '../../modules/messaging';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { getCachedRows } from '../../modules/messaging';
import { peerAvatarUrl } from '../../lib/peerProfiles';
import { peopleLookup } from './contacts.model';

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

const LOOKUP_DEBOUNCE_MS = 300;
const NO_MATCH_HINT = 'No matches. Try a username, a full address or a name.eth to start a chat.';

function ContactResultRow({ title, subtitle, address, dark, onPress }: {
  title: string; subtitle?: string; address: string; dark: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} align="center" gap={12} onPress={onPress}>
      <Row align="center" gap={12} flex={1}>
        <Image src={peerAvatarUrl(address, 40)} size={40} radius="full" />
        <Col gap={2} flex={1}>
          <Text value={title} weight="semibold" truncate />
          {subtitle === undefined || subtitle === '' ? null : (
            <Caption value={subtitle} color="secondary" truncate />
          )}
        </Col>
      </Row>
    </ListViewItem>
  );
}

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

export function HomeContactResults(
  { query, noChannels }: { query: string; c: Colors; noChannels: boolean },
): React.ReactElement | null {
  const q = query.trim();
  const dark = useKitScheme() === 'dark';
  const existing = useMemo(() => getExistingPeers(), []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return existing.filter(p => {
      if (p.address.toLowerCase().includes(needle)) return true;
      const n = getPeerName(p.address);
      return !!n && n.toLowerCase().includes(needle);
    });
  }, [existing, q]);

  const resolved = useResolvedPeer(q, filtered.length === 0);
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  const open = (address: string, convId?: string): void => {
    const target = isAddress(address) ? address : (convId ?? address);
    void import('expo-router').then(({ router }) => {
      router.push({ pathname: '/[convId]', params: { convId: target } });
    });
  };

  const showResolved = resolved && !filtered.some(p => p.address.toLowerCase() === resolved.address);
  if (!q) return null;
  if (!showResolved && filtered.length === 0) {
    if (!noChannels) return null;
    return <EmptyState title={NO_MATCH_HINT} />;
  }

  const rows = [
    ...(showResolved
      ? [{
          address: resolved.address,
          convId: undefined,
          title: getPeerName(resolved.address) ?? (resolved.title === '' ? shortAddress(resolved.address) : resolved.title),
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

  return (
    <Box>
      <Box padding={{ x: 16, top: 16, bottom: 6 }}>
        <Caption value="PEOPLE" color="secondary" weight="semibold" />
      </Box>
      <ListView dark={dark}>
        {rows.map((r) => (
          <ContactResultRow
            key={`${r.address}-${r.convId ?? ''}`}
            title={r.title}
            subtitle={r.subtitle}
            address={r.address}
            dark={dark}
            onPress={() => { open(r.address, r.convId); }}
          />
        ))}
      </ListView>
    </Box>
  );
}
