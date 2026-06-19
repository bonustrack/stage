/**
 * @file Composable that loads and live-streams a conversation's messages into a reactive HistoryEntry feed.
 */
/** XMTP live-feed composable. The decoded-message → HistoryEntry envelope + reaction aggregation live in `xmtpEnvelope.ts` (re-exported here). Split so each file stays under the lint cap. */

import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { DecodedMessage } from '@xmtp/browser-sdk';
import { getOrCreateXmtpClient, convOfLine } from './xmtp';
import { envelopeOfXmtpMessage } from './xmtpEnvelope';
import type { HistoryEntry } from './types';

export {
  reactionsByMessage, isReactionEntry, envelopeOfXmtpMessage,
} from './xmtpEnvelope';

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface XmtpFeedHandle {
  events: Ref<HistoryEntry[]>;
  status: Ref<XmtpFeedStatus>;
  error: Ref<string | null>;
  inboxId: Ref<string>;
}

/** Per-conversation message cache so re-opening a channel renders its messages instantly (no loading spinner); the live history still refreshes in the background. Keyed by line, survives navigation within the SPA session. */
const feedCache = new Map<string, HistoryEntry[]>();

/** Vue composable: load a conversation's history then subscribe to its live stream. Events are returned newest-first so an inverted list can consume them unchanged. Pass `enabled=false` while the client is still booting to keep the feed idle. */
export function useXmtpFeed(line: Ref<string | null>, enabled: Ref<boolean>): XmtpFeedHandle {
  const events = ref<HistoryEntry[]>([]);
  const status = ref<XmtpFeedStatus>('idle');
  const error = ref<string | null>(null);
  const inboxId = ref<string>('');

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let streamCloser: { return?: () => Promise<unknown> } | null = null;
  let onVisibility: (() => void) | null = null;
  let activeLine: string | null = null;

  /** Teardown helper. */
  const teardown = (): void => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (streamCloser?.return) { void streamCloser.return().catch(() => undefined); streamCloser = null; }
    if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
  };

  /** Refresh helper. */
  const refresh = async (): Promise<void> => {
    const current = activeLine;
    if (!current) return;
    try {
      const conv = await convOfLine(current);
      if (!conv || cancelled || activeLine !== current) return;
      await conv.sync().catch(() => undefined);
      const msgs = await conv.messages({ limit: 100n });
      if (cancelled || activeLine !== current) return;
      /** `messages()` is oldest-first; flip for inverted feed. */
      const fresh = msgs.map(m => envelopeOfXmtpMessage(m, current)).reverse();
      if (events.value.length === 0) {
        events.value = fresh;
      } else {
        const seen = new Set(events.value.map(e => e.id));
        const additions = fresh.filter(e => !seen.has(e.id));
        if (additions.length) events.value = [...additions, ...events.value];
      }
      feedCache.set(current, events.value);
    } catch { /* next tick or visibility flip retries */ }
  };

  /** Append a streamed message to the feed (deduped) and update the cache. */
  const ingestStreamed = (msg: DecodedMessage | undefined): void => {
    if (cancelled || !msg || activeLine === null) return;
    const env = envelopeOfXmtpMessage(msg, activeLine);
    if (!events.value.some(e => e.id === env.id)) {
      events.value = [env, ...events.value];
      feedCache.set(activeLine, events.value);
    }
  };

  /** Open the live conversation stream as a backstop-supplemented real-time source. */
  const attachStream = async (current: string): Promise<void> => {
    try {
      const conv = await convOfLine(current);
      if (conv && !cancelled) {
        streamCloser = await conv.stream({ onValue: ingestStreamed });
      }
    } catch { /* stream init failed — poll backstop keeps the feed fresh */ }
  };

  /** Wire the visibility-refresh listener and the 5s poll backstop. */
  const attachBackstops = (): void => {
    onVisibility = (): void => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    pollTimer = setInterval(() => { void refresh(); }, 5_000);
  };

  /** Seed the feed from cache and set the initial loading/open status. */
  const seedFromCache = (): void => {
    const seeded = line.value ? feedCache.get(line.value) : undefined;
    events.value = seeded ? [...seeded] : [];
    status.value = seeded?.length ? 'open' : 'loading';
  };

  /** Start helper. */
  const start = async (): Promise<void> => {
    if (!enabled.value || !line.value) { status.value = 'idle'; return; }
    const current = line.value;
    activeLine = current;
    cancelled = false;
    error.value = null;
    /** Seed instantly from cache so re-opening a channel skips the spinner. */
    seedFromCache();
    try {
      const client = await getOrCreateXmtpClient('production');
      if (cancelled || activeLine !== line.value) return;
      inboxId.value = client.inboxId ?? '';
      await refresh();
      status.value = 'open';
      await attachStream(current);
      attachBackstops();
    } catch (e) {
      if (cancelled) return;
      status.value = 'error';
      error.value = (e as Error).message;
    }
  };

  /** Restart helper. */
  const restart = (): void => { cancelled = true; teardown(); void start(); };

  void start();
  const stopWatch = watch([line, enabled], restart);
  onUnmounted(() => { cancelled = true; teardown(); stopWatch(); });

  return { events, status, error, inboxId };
}
