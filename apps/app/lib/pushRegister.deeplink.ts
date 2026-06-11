/** Notification-tap deep-link handling.
 *
 *  Extracted from pushRegister.ts (mechanical split, behavior identical). */

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { router } from 'expo-router';
// TEMPORARY nav-restore instrumentation — see lib/navTrace. Remove with it.
import { record as navTrace, shortId } from './navTrace';
/** Deferred to break the deeplink → channelsCache → xmtp.client → push → … cycle.
 *  The unread-clear is already async + best-effort, so the lazy import is invisible. */
const markConvRead = async (convId: string): Promise<void> => {
  const { markConvRead: fn } = await import('./channelsCache');
  return fn(convId);
};

/** Extract the conversation id a notification points at. Both the foreground
 *  local notif (`presentInboundNotification`, data.convId) and the daemon's
 *  remote FCM push carry the conv id in `data` — accept the common aliases the
 *  daemon may use (`convId` / `conversationId` / a `line` like
 *  `metro://xmtp/<acct>/<convId>`). Returns null when none is present. */
function convIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const direct = d.convId ?? d.conversationId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (typeof d.line === 'string') {
    // metro://xmtp/<account>/<convId>  → last non-empty path segment.
    const seg = d.line.replace(/[?#].*$/, '').split('/').filter(Boolean);
    const last = seg[seg.length - 1];
    if (last && last !== 'xmtp') return last;
  }
  return null;
}

/** Navigate to the conversation a tapped notification points at + clear its
 *  unread badge. Shared by the cold-start (getLastNotificationResponse) and
 *  warm (addNotificationResponseReceivedListener) paths. Best-effort. */
function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdFromNotificationData(response.notification?.request?.content?.data);
  navTrace('push.response.push', { convId: shortId(convId) });
  if (!convId) return;
  router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  // Clearing unread is async + best-effort; the nav already happened.
  void markConvRead(convId).catch(() => undefined);
}

/** Install the notification-tap deep-link handler once for the app's lifetime.
 *  Mount in the root layout. Handles BOTH:
 *   - cold start: the app was launched by tapping a push while killed
 *     (`getLastNotificationResponseAsync`),
 *   - warm/background: a tap arrives while the app is alive/backgrounded
 *     (`addNotificationResponseReceivedListener`).
 *  On tap it routes to `/xmtp/[convId]` and calls `markConvRead` so the unread
 *  badge clears immediately.
 *
 *  STALE COLD-START RESPONSE = the ~0.5s auto-redirect bug. expo-notifications'
 *  `getLastNotificationResponseAsync()` returns the MOST RECENT notification
 *  interaction and KEEPS returning that same response on EVERY cold start until
 *  it is explicitly cleared (see the module docs on
 *  `clearLastNotificationResponse`: "may be used when an app selects a route
 *  based on the notification response, and it is undesirable to continue
 *  selecting the route after the response has already been handled"). The
 *  previous code consumed the response but never cleared it, so once the user
 *  had EVER tapped a push to open a channel, every subsequent normal launch
 *  (including a plain kill+reopen from the launcher) re-resolved that stale
 *  response ~0.5s after boot and `router.push`-ed the channel again — racing
 *  the lastRoute restore and shoving the user back into the conversation after
 *  they'd pressed back to Home. We now CLEAR the response the instant we read
 *  it on cold start, so it can only ever drive a single navigation and a normal
 *  relaunch no longer re-fires it. */
export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    // Cold-start: a tap that launched the app from killed state. Read it, act on
    // it, then CLEAR it so the native layer can't replay it on the next launch.
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        navTrace('push.lastResponse', { hasResponse: !!resp });
        if (cancelled || !resp) return;
        // Consume: clear before navigating so a relaunch never sees this again.
        try { Notifications.clearLastNotificationResponse(); } catch { /* older runtime / unavailable — best-effort */ }
        openConvFromResponse(resp);
      })
      .catch(() => undefined);
    // Warm/background taps while the app is alive.
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
}
