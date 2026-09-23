import { AppState } from 'react-native';
import { setAppForeground, subscribeXmtpPush } from '../modules/stage-pill';
import { markBackgroundDelivered } from './pushNotify';
import { reclaimSharedDb, releaseSharedDb } from './xmtp.dbConnection';
import { resyncActiveFeeds, syncInboxOnce } from './xmtp.resync';
import type { StreamStatus } from './xmtp.types';
import { attempt } from './errorPolicy';

const PUSH_RESYNC_DELAY_MS = 300;
const MIN_FORCED_SYNC_SPACING_MS = 4_000;
const STREAM_FRESH_MS = 3_000;
const STREAM_DEAD_GRACE_MS = 5_000;

let appStateSub: { remove: () => void } | null = null;
let pushSub: (() => void) | null = null;
let pushResyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastForcedPushSyncAt = 0;

async function resyncAfterPush(status: StreamStatus, now: number): Promise<void> {
  const streamDead = !status.live() || (now - status.lastCloseAt()) < STREAM_DEAD_GRACE_MS;
  const streamFresh = (now - status.lastMessageAt()) < STREAM_FRESH_MS;
  if (streamDead) {
    lastForcedPushSyncAt = now;
    await syncInboxOnce(0);
    await resyncActiveFeeds();
    return;
  }
  if (streamFresh) {
    await resyncActiveFeeds();
    return;
  }
  if (now - lastForcedPushSyncAt >= MIN_FORCED_SYNC_SPACING_MS) {
    lastForcedPushSyncAt = now;
    await syncInboxOnce(0);
  }
  await resyncActiveFeeds();
}

function onXmtpPush(status: StreamStatus): void {
  if (pushResyncTimer) clearTimeout(pushResyncTimer);
  pushResyncTimer = setTimeout(() => {
    pushResyncTimer = null;
    void resyncAfterPush(status, Date.now());
  }, PUSH_RESYNC_DELAY_MS);
}

export const foregroundWatch = {
  attach(status: StreamStatus): void {
    pushSub ??= subscribeXmtpPush((e) => {
      if (AppState.currentState !== 'active') markBackgroundDelivered(e?.messageId);
      onXmtpPush(status);
    });
    setAppForeground(AppState.currentState === 'active');
    appStateSub ??= AppState.addEventListener('change', (state) => {
      setAppForeground(state === 'active');
      if (state === 'background') void releaseSharedDb();
      if (state !== 'active') return;
      void reclaimSharedDb().then(() => {
        void resyncActiveFeeds();
        if (!status.live()) status.ensure();
      });
    });
  },
  detach(): void {
    if (pushResyncTimer) { clearTimeout(pushResyncTimer); pushResyncTimer = null; }
    lastForcedPushSyncAt = 0;
    if (pushSub) { attempt(pushSub, 'cleanup'); pushSub = null; }
    const sub = appStateSub;
    if (sub) { attempt(() => { sub.remove(); }, 'cleanup'); appStateSub = null; }
    setAppForeground(false);
  },
};
