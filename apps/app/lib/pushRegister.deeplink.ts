/** @file `usePushDeepLinks` hook that routes a tapped notification (cold-start and warm) to `/xmtp/[convId]`, clearing the stale cold-start response so a relaunch can't re-fire it. */

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { router } from 'expo-router';
/** Deferred to break the deeplink → channelsCache → xmtp.client → push → … cycle. The unread-clear is already async + best-effort, so the lazy import is invisible. */
const markConvRead = async (convId: string): Promise<void> => {
  const { markConvRead: fn } = await import('./channelsCache');
  return fn(convId);
};

/** Extract the conversation id a notification points at, accepting the daemon's common aliases (`convId` / `conversationId` / a `metro://xmtp/<acct>/<convId>` line); null when none is present. */
function convIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const direct = d.convId ?? d.conversationId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (typeof d.line === 'string') {
    /** metro://xmtp/<account>/<convId>  → last non-empty path segment. */
    const seg = d.line.replace(/[?#].*$/, '').split('/').filter(Boolean);
    const last = seg[seg.length - 1];
    if (last && last !== 'xmtp') return last;
  }
  return null;
}

/** Navigate to the conversation a tapped notification points at + clear its unread badge. Shared by the cold-start (getLastNotificationResponse) and warm (addNotificationResponseReceivedListener) paths. Best-effort. */
function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdFromNotificationData(response.notification?.request?.content?.data);
  if (!convId) return;
  router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  /** Clearing unread is async + best-effort; the nav already happened. */
  void markConvRead(convId).catch(() => undefined);
}

/** Install the notification-tap deep-link handler once (mount in root layout): routes both cold-start and warm/background taps to `/xmtp/[convId]` + markConvRead, and CLEARS the cold-start response on read so a stale response can't re-fire the ~0.5s auto-redirect on later launches. */
export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    /** Cold-start tap that launched the app from killed state: read it, act on it, then CLEAR it so the native layer can't replay it on the next launch. */
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (cancelled || !resp) return;
        /** Consume: clear before navigating so a relaunch never sees this again. */
        try { Notifications.clearLastNotificationResponse(); } catch { /* older runtime / unavailable — best-effort */ }
        openConvFromResponse(resp);
      })
      .catch(() => undefined);
    /** Warm/background taps while the app is alive. */
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
}
