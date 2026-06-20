
import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { feedCache, activeFeedLines } from '../../lib/xmtp.state';
import { PAGE_SIZE } from '../../lib/xmtp.resync';

function feedLatest(line: string): HistoryEntry | undefined {
  const slice = feedCache.get(line);
  if (!slice) return undefined;
  return slice.find(e => !isMetroControlBody(e.text));
}

function entryNs(e: HistoryEntry): number {
  const ms = new Date(e.ts).getTime();
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

function reloadSlice(line: string, msgs: HistoryEntry[]): void {
  const page = msgs.filter(e => !isMetroControlBody(e.text));
  const prev = feedCache.get(line) ?? [];
  const seen = new Set(prev.map(e => e.id));
  const fresh = page.filter(e => !seen.has(e.id));
  if (fresh.length === 0) return;
  feedCache.set(line, [...fresh, ...prev]);
}

function logReconcileHeal(
  label: string, line: string, healedBy: string,
  before: HistoryEntry | undefined, after: { id: string | null; ts: string | null },
): void {
  console.log(
    label,
    JSON.stringify({
      line,
      feedLatestId: before?.id ?? null,
      feedLatestTs: before?.ts ?? null,
      storeLatestId: after.id,
      storeLatestTs: after.ts,
      healedBy,
    }),
  );
}

export async function reconcileOnOpen(line: string): Promise<void> {
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    const [storeLatestMsg] = await conv.messages({ limit: 1 });
    if (!storeLatestMsg) return;
    const storeLatest = envelopeOfXmtpMessage(storeLatestMsg, line);
    if (isMetroControlBody(storeLatest.text)) return;
    const feed = feedLatest(line);
    if (feed?.id === storeLatest.id) return;
    const page = await conv.messages({ limit: PAGE_SIZE });
    reloadSlice(line, page.map(m => envelopeOfXmtpMessage(m, line)));
    logReconcileHeal('[feed-reconcile] open-time heal', line, 'reconcileOnOpen', feed, storeLatest);
  } catch { }
}

export async function reconcileOnArrival(
  line: string, prevLatestNs: number, arrivingNs: number, arrivingId: string,
): Promise<void> {
  if (!activeFeedLines.has(line)) return;
  const latestNow = feedLatest(line);
  if (latestNow?.id === arrivingId && arrivingNs >= prevLatestNs) return;
  await healArrivalGap(line);
}

async function healArrivalGap(line: string): Promise<void> {
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    await conv.sync().catch(() => undefined);
    const page = await conv.messages({ limit: PAGE_SIZE });
    const mapped = page.map(m => envelopeOfXmtpMessage(m, line)).filter(e => !isMetroControlBody(e.text));
    const before = feedLatest(line);
    reloadSlice(line, mapped);
    const after = feedLatest(line);
    if (before?.id !== after?.id) {
      logReconcileHeal(
        '[feed-reconcile] arrival-gap heal', line, 'reconcileOnArrival',
        before, { id: after?.id ?? null, ts: after?.ts ?? null },
      );
    }
  } catch { }
}

export function feedLatestNs(line: string): number {
  const e = feedLatest(line);
  return e ? entryNs(e) : 0;
}
