import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { isAddress } from 'viem';
import { Eyebrow } from '../Eyebrow';
import { EmptyState } from '../chrome/EmptyState';
import { ChannelRow } from '../chatRow/ChannelRow';
import { shortAddress } from '@stage-labs/client/identity/format';
import { usePersonLookup } from '../../lib/resolveHandle';
import { WITH_MAINNET_ENS } from '@stage-labs/client/identity/personLookup';
import { usePeerProfiles, getPeerName, peerLabel } from '../../lib/peerProfiles';
import { conversationSlugLinkOf } from '@stage-labs/client/routing/deepLinks';
import { dmLinkOf } from '../../lib/links';
import type { CachedRow } from '../../lib/cachedRows.model';
import { uniqueBy } from '@stage-labs/client/collections';
import { Column, PAGE_GUTTER } from '../layout';

interface Peer {
  address: string;
  convId: string;
}

function existingPeers(rows: readonly CachedRow[] | null): Peer[] {
  const peers = (rows ?? []).flatMap(({ peerAddress: address, convId }) => (address && convId ? [{ address, convId }] : []));
  return uniqueBy(peers, (p) => p.address.toLowerCase());
}

const NO_MATCH_HINT = 'No matches. Try a username, a full address or a name.eth to start a chat.';

interface ResolvedPeer {
  address: string;
  label: string | null;
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
  return { address: p.address, convId: p.convId, title: peerLabel(p.address), subtitle: name ? shortAddress(p.address) : undefined };
}

function ContactRows({ rows, label }: { rows: ResultRow[]; label: string }): React.ReactElement {
  const router = useRouter();
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
            router.push(isAddress(r.address) ? dmLinkOf(r.address) : conversationSlugLinkOf(r.convId ?? r.address));
          }}
        />
      ))}
    </Column>
  );
}

export function HomeContactResults({
  query,
  noChannels,
  rows: chats,
}: {
  query: string;
  noChannels: boolean;
  rows: readonly CachedRow[] | null;
}): React.ReactElement | null {
  const q = query.trim();
  const existing = useMemo(() => existingPeers(chats), [chats]);
  const filtered = useMemo(() => filterPeers(existing, q), [existing, q]);
  const lookup = usePersonLookup(q, WITH_MAINNET_ENS, filtered.length === 0);
  const resolved: ResolvedPeer | null =
    filtered.length === 0 && lookup.kind === 'resolved' ? { address: lookup.address, label: lookup.label } : null;
  usePeerProfiles([resolved?.address, ...existing.map((p) => p.address)]);

  const extra = resolved && !filtered.some((p) => p.address.toLowerCase() === resolved.address) ? [resolvedRow(resolved)] : [];
  const rows = [...extra, ...filtered.map(peerRow)];
  if (!q) return null;
  if (rows.length === 0) return noChannels ? <EmptyState title={NO_MATCH_HINT} /> : null;
  return <ContactRows rows={rows} label="PEOPLE" />;
}
