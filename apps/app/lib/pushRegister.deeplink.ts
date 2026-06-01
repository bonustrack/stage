/** Notification-tap deep-link handling.
 *
 *  Extracted from pushRegister.ts (mechanical split, behavior identical). */

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { markConvRead } from './channelsCache';

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
 *  badge clears immediately. */
export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    // Cold-start: a tap that launched the app from killed state.
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => { if (!cancelled) openConvFromResponse(resp); })
      .catch(() => undefined);
    // Warm/background taps while the app is alive.
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
}
