
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { router } from 'expo-router';
const markConvRead = async (convId: string): Promise<void> => {
  const { markConvRead: fn } = await import('./channelsCache');
  return fn(convId);
};

function convIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const direct = d.convId ?? d.conversationId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (typeof d.line === 'string') {
    const seg = d.line.replace(/[?#].*$/, '').split('/').filter(Boolean);
    const last = seg[seg.length - 1];
    if (last && last !== 'xmtp') return last;
  }
  return null;
}

function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdFromNotificationData(response.notification?.request?.content?.data);
  if (!convId) return;
  router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  void markConvRead(convId).catch(() => undefined);
}

export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (cancelled || !resp) return;
        try { Notifications.clearLastNotificationResponse(); } catch { }
        openConvFromResponse(resp);
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
}
