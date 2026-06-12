/** Read-state PROVIDER — the pluggable seam for how a conversation's read
 *  cursor is derived + synced across devices.
 *
 *  DESIGN (2026-06, Less's pushback): read markers are too high-frequency for a
 *  per-event append log. So read state is NOT a delta-per-read. Instead the
 *  durable cursor for a conv is:
 *
 *      cursor(conv) = max(
 *        lastSentNs(conv),   // your last SENT message ts — XMTP syncs this for
 *                            // FREE across devices, zero extra writes. Any chat
 *                            // you actually reply in costs nothing to sync.
 *        fallbackNs(conv),   // a coalesced LWW register for convs you READ but
 *                            // never replied to — published AT MOST ONCE per
 *                            // app-background over the channel-prefs self-group.
 *      )
 *
 *  This module is the single place unread derivation reads from, so the rest of
 *  the app never needs to know which strategy is live. Less is still voting
 *  between three strategies (piggyback+fallback / read stays device-local /
 *  small backend KV); each is a `ReadStateProvider`, and `setReadStateProvider`
 *  swaps the active one without touching call sites. The default below is
 *  piggyback+fallback, but the DURABLE WRITE PATH (publishing the fallback
 *  cursor onto the self-group) stays gated behind `channelPrefsSync` until the
 *  poll lands — until then this provider is effectively device-local + free
 *  same-account sync via XMTP's own sent-message history.
 *
 *  ZERO @xmtp / heavy imports: it operates on already-resolved numbers
 *  (`lastSentNs` is fed in by the cache/stream layer) so it stays unit-testable
 *  and cheap to call on every row render. */

/** A pluggable read-state strategy. Implementations decide how the per-conv
 *  cursor is sourced + whether/when it is durably published. */
export interface ReadStateProvider {
  /** Stable id for diagnostics + the eventual poll wiring. */
  readonly id: 'piggyback-fallback' | 'device-local' | 'backend-kv';
  /** The effective read cursor (ns) for a conv given the XMTP-synced last-sent
   *  ts (or 0 if you never sent). Pure: combines piggyback + fallback. */
  cursorNs: (convId: string, lastSentNs: number) => number;
  /** Record that a conv was read up to `ns` on THIS device. Cheap + local; it
   *  does NOT write to the network (coalesced publish happens on background via
   *  `drainFallbackCursors`). */
  noteRead: (convId: string, ns: number) => void;
  /** Fold a fallback cursor arriving from another device (LWW by ns). */
  applyRemoteFallback: (convId: string, ns: number) => void;
  /** Drain the fallback cursors that advanced since the last drain, for the
   *  once-per-background coalesced publish. Returns convId -> ns string map and
   *  clears the dirty set. Empty when nothing changed (so we skip the send). */
  drainFallbackCursors: () => Record<string, string>;
}

/** Default provider: piggyback on XMTP-synced sent messages, plus an in-memory
 *  fallback cursor for read-but-never-replied convs that is published once per
 *  background. Per-read calls are O(1) map writes — no network, no AsyncStorage
 *  churn on the hot path. */
function createPiggybackFallbackProvider(): ReadStateProvider {
  /** Latest fallback cursor we know for each conv (max of local reads + remote
   *  fallbacks folded in). */
  const fallback = new Map<string, number>();
  /** Convs whose fallback advanced LOCALLY since the last drain — only these
   *  are published on background. */
  const dirty = new Set<string>();

  return {
    id: 'piggyback-fallback',

    cursorNs(convId, lastSentNs) {
      const fb = fallback.get(convId) ?? 0;
      return Math.max(lastSentNs > 0 ? lastSentNs : 0, fb);
    },

    noteRead(convId, ns) {
      if (!Number.isFinite(ns) || ns <= 0) return;
      const cur = fallback.get(convId) ?? 0;
      if (ns > cur) {
        fallback.set(convId, ns);
        dirty.add(convId);
      }
    },

    applyRemoteFallback(convId, ns) {
      if (!Number.isFinite(ns) || ns <= 0) return;
      const cur = fallback.get(convId) ?? 0;
      /** Remote write — fold by LWW, but do NOT mark dirty (we didn't originate
       *  it, re-publishing would echo). */
      if (ns > cur) fallback.set(convId, ns);
    },

    drainFallbackCursors() {
      const out: Record<string, string> = {};
      for (const convId of dirty) {
        const ns = fallback.get(convId);
        if (ns && ns > 0) out[convId] = String(ns);
      }
      dirty.clear();
      return out;
    },
  };
}

/** The active provider. Swappable so the eventual poll outcome (device-local /
 *  backend-kv) is a one-line change, not a refactor of every call site. */
let active: ReadStateProvider = createPiggybackFallbackProvider();

/** Replace the active read-state provider (poll wiring / tests). */
export function setReadStateProvider(p: ReadStateProvider): void {
  active = p;
}

/** The active read-state provider. */
export function readState(): ReadStateProvider {
  return active;
}
