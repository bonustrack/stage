import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { PUSH_ORIGIN } from '@stage-labs/client/endpoints';
import { pushRpcPath, type PushPlatform, type PushRpc } from '@stage-labs/client/xmtp/pushServer';
import { convIdOfNotificationData, notificationIdsForConv, toPermission, type PushPermission } from './pushNotify.model';
import { channelLinkOf } from '@stage-labs/client/routing/deepLinks';
import { markConvRead } from './channelsCache';
import { envBaseUrl } from './env';
import { attempt, report, reported } from './errorPolicy';

Notifications.setNotificationHandler({
  handleNotification: () => Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

const PUSH_SERVER_URL = envBaseUrl(process.env.EXPO_PUBLIC_PUSH_SERVER_URL, PUSH_ORIGIN);

export const PUSH_PLATFORM: PushPlatform = Platform.OS === 'android' ? 'android' : 'ios';

export function pushRpcUrl(method: PushRpc): string {
  return `${PUSH_SERVER_URL}${pushRpcPath(method)}`;
}

export function isPushSupported(): boolean {
  return true;
}

export async function getPushPermission(): Promise<PushPermission> {
  try {
    return toPermission((await Notifications.getPermissionsAsync()).status);
  } catch {
    return 'undetermined';
  }
}

export async function requestPushPermission(): Promise<PushPermission> {
  try {
    return toPermission((await Notifications.requestPermissionsAsync()).status);
  } catch {
    return 'undetermined';
  }
}

async function ensureNotificationReady(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('xmtp', {
      name: 'XMTP messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      showBadge: true,
    });
  }
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function pushToken(): Promise<string | null> {
  if (!(await ensureNotificationReady())) return null;
  try {
    const resp = await Notifications.getDevicePushTokenAsync();
    return typeof resp.data === 'string' ? resp.data : null;
  } catch {
    return null;
  }
}

const bgDeliveredMsgIds = new Set<string>();
const BG_DELIVERED_MAX = 200;

export function markBackgroundDelivered(messageId: string | null | undefined): void {
  if (!messageId) return;
  bgDeliveredMsgIds.add(messageId);
  if (bgDeliveredMsgIds.size > BG_DELIVERED_MAX) {
    const oldest = bgDeliveredMsgIds.values().next().value;
    if (oldest !== undefined) bgDeliveredMsgIds.delete(oldest);
  }
}

function consumeBackgroundDelivered(messageId: string | undefined): boolean {
  return messageId !== undefined && messageId !== '' && bgDeliveredMsgIds.delete(messageId);
}

export async function presentInboundNotification(args: { title: string; body: string; convId: string; messageId?: string }): Promise<void> {
  try {
    if (consumeBackgroundDelivered(args.messageId) || !(await ensureNotificationReady())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: 'default',
        data: { convId: args.convId, messageId: args.messageId ?? null, kind: 'xmtp-inbound' },
        ...(Platform.OS === 'android' ? { channelId: 'xmtp' } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    report('push.presentInbound', err);
  }
}

export async function dismissConvNotifications(convId: string): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const ids = notificationIdsForConv(
    presented.map((n) => ({ identifier: n.request.identifier, data: n.request.content.data })),
    convId,
    Platform.OS === 'android',
  );
  await Promise.all(ids.map((id) => Notifications.dismissNotificationAsync(id)));
}

function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdOfNotificationData(response.notification?.request?.content?.data);
  if (!convId) return;
  router.push(channelLinkOf(convId));
  void markConvRead(convId).catch(reported('push.markRead'));
}

export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (cancelled || !resp) return;
        attempt(() => {
          Notifications.clearLastNotificationResponse();
        }, 'cleanup');
        openConvFromResponse(resp);
      })
      .catch(reported('push.lastResponse'));
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
