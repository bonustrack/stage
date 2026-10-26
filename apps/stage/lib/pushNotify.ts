import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationIdsForConv } from './pushNotify.model';

Notifications.setNotificationHandler({
  handleNotification: () => Promise.resolve({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('xmtp', {
    name: 'XMTP messages',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    showBadge: true,
  });
}

async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureNotificationReady(): Promise<boolean> {
  await ensureChannel();
  return ensurePermission();
}

export async function getDeviceFcmToken(): Promise<string | null> {
  if (!(await ensureNotificationReady())) return null;
  try {
    const resp = await Notifications.getDevicePushTokenAsync();
    return typeof resp.data === 'string' ? resp.data : null;
  } catch { return null; }
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

export async function presentInboundNotification(args: {
  title: string;
  body: string;
  convId: string;
  messageId?: string;
}): Promise<void> {
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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('presentInboundNotification failed', (err as Error).message);
    }
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
