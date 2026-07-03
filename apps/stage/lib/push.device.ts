

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: () => {
    return Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  },
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

export async function getDeviceFcmToken(): Promise<string | null> {
  await ensureChannel();
  const granted = await ensurePermission();
  if (!granted) return null;
  try {
    const resp = await Notifications.getDevicePushTokenAsync();
    return typeof resp.data === 'string' ? resp.data : null;
  } catch { return null; }
}

export async function ensureNotificationReady(): Promise<boolean> {
  await ensureChannel();
  return ensurePermission();
}
