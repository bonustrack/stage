/** Shared event-bucketing helper for the Activity chart. */
/** Imported by apps/app (RN) and apps/ui (Vue) — keep dependency-free. */

export interface BucketEvent {
  ts: string;
  station: string;
}

export interface ActivityBucket {
  /** Start-of-hour timestamp (local). */
  hour: Date;
  /** Total events in this hour bucket. */
  count: number;
  /** Station with the most events in the bucket (empty when count === 0). */
  dominantStation: string;
}

/**
 * Bucket events by hour-of-day over the last `hours` (default 24), rolling from now.
 * The output is ordered oldest → newest and always has exactly `hours` entries
 * (zero-count buckets are kept so the bar grid stays stable).
 */
export function bucketByHour(events: ReadonlyArray<BucketEvent>, hours = 24): ActivityBucket[] {
  const now = Date.now();
  const HOUR_MS = 3600_000;
  /** Anchor at the current hour boundary so adjacent buckets align with the wall clock. */
  const anchor = Math.floor(now / HOUR_MS) * HOUR_MS;
  const start = anchor - (hours - 1) * HOUR_MS;
  /** Pre-seed buckets so empty hours still render in the right slot. */
  const buckets: { hour: Date; counts: Map<string, number>; total: number }[] = [];
  for (let i = 0; i < hours; i++) {
    buckets.push({ hour: new Date(start + i * HOUR_MS), counts: new Map(), total: 0 });
  }
  for (const e of events) {
    const t = Date.parse(e.ts);
    if (!Number.isFinite(t)) continue;
    if (t < start || t >= anchor + HOUR_MS) continue;
    const idx = Math.floor((t - start) / HOUR_MS);
    if (idx < 0 || idx >= hours) continue;
    const b = buckets[idx];
    b.counts.set(e.station, (b.counts.get(e.station) ?? 0) + 1);
    b.total += 1;
  }
  return buckets.map(b => ({
    hour: b.hour,
    count: b.total,
    dominantStation: dominantOf(b.counts),
  }));
}

function dominantOf(counts: Map<string, number>): string {
  let bestKey = '';
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { bestKey = k; bestN = n; }
  }
  return bestKey;
}
