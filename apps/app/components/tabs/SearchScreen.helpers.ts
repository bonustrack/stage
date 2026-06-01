/** Types, constants, and search logic for SearchScreen.
 *
 *  Extracted from SearchScreen.tsx (mechanical split, behavior identical). */
import { getCachedRows } from '../../lib/channelsCache';
import { getCachedXmtpClient } from '../../lib/xmtp';
import { getPeerName } from '../../lib/peerProfiles';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';

/** How many recent messages to scan per conversation, and how many conversations
 *  to scan, so message search stays bounded regardless of inbox size. */
export const RECENT_PER_CONV = 40;
export const MAX_CONVS_SCANNED = 40;
/** Max message hits surfaced. */
export const MAX_MSG_HITS = 30;
export const DEBOUNCE_MS = 200;

/** Minimal shape we read off a cached channels row. */
export interface ConvRow {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarAddress: string | null;
  avatarUri: string | null;
  lastTs: number | null;
}

export interface MsgHit {
  convId: string;
  convTitle: string;
  peerAddress: string | null;
  snippet: string;
  sentNs: number;
}

/** Cheap pre-flight — accept any *.eth (multi-label) as ENS-resolvable. */
export function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(s.trim());
}

/** Per-session cache of humanised message text per conv, so repeat queries don't
 *  re-decode. Keyed by convId → array of { text, sentNs }. Module-level so it
 *  survives tab remounts within a session. */
const msgTextCache = new Map<string, { text: string; sentNs: number }[]>();

export function readConvRows(): ConvRow[] {
  const rows = getCachedRows() ?? [];
  return rows.map(r => ({
    convId: String((r as { convId?: string }).convId ?? ''),
    title: String((r as { title?: string }).title ?? ''),
    peerAddress: ((r as { peerAddress?: string | null }).peerAddress) ?? null,
    avatarAddress: ((r as { avatarAddress?: string | null }).avatarAddress) ?? null,
    avatarUri: ((r as { avatarUri?: string | null }).avatarUri) ?? null,
    lastTs: ((r as { lastTs?: number | null }).lastTs) ?? null,
  })).filter(r => r.convId);
}

/** Bounded, cancellable message-text search across the most-recently-active
 *  convs. `isCancelled` is polled so the caller can abort on a new query.
 *  Returns hits sorted newest-first (caller sets state). */
export async function searchMessageText(
  convRows: ConvRow[],
  needle: string,
  isCancelled: () => boolean,
): Promise<MsgHit[]> {
  const client = getCachedXmtpClient();
  /** Scan the most-recently-active convs first (already sorted-ish by lastTs). */
  const scan = [...convRows]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .slice(0, MAX_CONVS_SCANNED);

  const hits: MsgHit[] = [];

  for (const r of scan) {
    if (isCancelled()) return hits;
    let texts = msgTextCache.get(r.convId);
    if (!texts) {
      texts = [];
      if (client) {
        try {
          const conv = await client.conversations.findConversation(
            r.convId as unknown as Parameters<typeof client.conversations.findConversation>[0],
          );
          if (conv) {
            const msgs = await conv.messages({ limit: RECENT_PER_CONV }).catch(() => []);
            for (const m of msgs) {
              let text = '';
              try { text = previewOfXmtpContent(m.content(), m.contentTypeId); }
              catch { text = ''; }
              if (text) texts.push({ text, sentNs: m.sentNs ?? 0 });
            }
          }
        } catch { /* leave texts empty for this conv */ }
      }
      msgTextCache.set(r.convId, texts);
    }
    if (isCancelled()) return hits;
    for (const t of texts) {
      if (t.text.toLowerCase().includes(needle)) {
        hits.push({
          convId: r.convId,
          convTitle: r.peerAddress ? (getPeerName(r.peerAddress) ?? r.title) : r.title,
          peerAddress: r.peerAddress,
          snippet: t.text.slice(0, 120),
          sentNs: t.sentNs,
        });
        if (hits.length >= MAX_MSG_HITS) break;
      }
    }
    if (hits.length >= MAX_MSG_HITS) break;
  }

  hits.sort((a, b) => b.sentNs - a.sentNs);
  return hits;
}
