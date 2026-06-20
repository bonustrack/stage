/** @file Leaf helpers (no XMTP imports) that request notification permission, register the Android 'xmtp' channel, set the foreground notification handler, and fetch the raw FCM/APNs device token. */

/** Device-token + notification-readiness helpers (leaf, no XMTP imports): request POST_NOTIFICATIONS, register the 'xmtp' channel, and fetch the raw FCM/APNs token; split out of lib/push.ts to avoid a push ↔ pushRegister cycle. */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Banner + sound even when the app is in the foreground. expo-notifications defaults to suppressing both. Set globally so it applies regardless of which screen is mounted when the push arrives. */
Notifications.setNotificationHandler({
  handleNotification: () => {
    /** The JS local-notification path was removed (daemon + native MetroFcmService are the single inbound-push source and bypass this handler), so there's nothing to de-dup; whatever still reaches here (e.g. a non-native expo push) is surfaced with no suppression. */
    return Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  },
});

/** Ensure Channel. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('xmtp', {
    name: 'XMTP messages',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    showBadge: true,
  });
}

/** Ensure Permission. */
async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Resolve the FCM (Android) / APNs (iOS) device token for this install. Returns null when permission is denied or the platform doesn't deliver one (emulator without Play Services, web build, etc.). */
export async function getDeviceFcmToken(): Promise<string | null> {
  await ensureChannel();
  const granted = await ensurePermission();
  if (!granted) return null;
  try {
    const resp = await Notifications.getDevicePushTokenAsync();
    return typeof resp.data === 'string' ? resp.data : null;
  } catch { return null; }
}

/** Ensure the 'xmtp' channel exists and POST_NOTIFICATIONS is granted. Shared with the foreground local-notification path in lib/pushRegister.ts. Returns true when the device is ready to display a notification. */
export async function ensureNotificationReady(): Promise<boolean> {
  await ensureChannel();
  return ensurePermission();
}
