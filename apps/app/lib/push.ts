/** Push-notification helper for the XMTP messenger.
 *
 *  Two delivery paths, per the push design (option b):
 *
 *  1. BACKGROUND push (daemon-run accounts only). The daemon-side xmtp train
 *     fans out FCM v1 pushes for inbound DMs. To receive them this device must
 *     register its raw FCM/APNs device token with the daemon, scoped to the
 *     active account. We do that automatically — no manual `metro call` — by
 *     sending a private XMTP control DM (`register-push`) to the daemon's inbox
 *     (`registerPushWithDaemon`). The daemon stores `{token, account, inboxId,
 *     platform}` and pushes only for that account.
 *
 *  2. FOREGROUND local notifications (any account, incl. phone-only wallets the
 *     daemon has no key for). While the app is running, the global XMTP message
 *     stream calls `presentInboundNotification` for each incoming message so the
 *     user is notified without any daemon/background involvement.
 *
 *  Device-token acquisition (steps 1–3 of the old flow) is unchanged:
 *    1. Request POST_NOTIFICATIONS permission (Android 13+).
 *    2. Register the 'xmtp' notification channel the daemon + local path target.
 *    3. Fetch its raw FCM/APNs device token via expo-notifications. */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Banner + sound even when the app is in the foreground. expo-notifications
 *  defaults to suppressing both. Set globally so it applies regardless of which
 *  screen is mounted when the push arrives. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

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
  if (existing.status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

/** Resolve the FCM (Android) / APNs (iOS) device token for this install. Returns
 *  null when permission is denied or the platform doesn't deliver one (emulator
 *  without Play Services, web build, etc.). */
export async function getDeviceFcmToken(): Promise<string | null> {
  await ensureChannel();
  const granted = await ensurePermission();
  if (!granted) return null;
  try {
    const resp = await Notifications.getDevicePushTokenAsync();
    return typeof resp.data === 'string' ? resp.data : null;
  } catch { return null; }
}

/** React hook variant — kicks the registration flow on mount and exposes the
 *  resulting status + token. UI components observe { status, token } to render
 *  appropriate copy ("Tap to allow", "Pasting needed", etc.). */
export function usePushToken(): { status: PushStatus; token: string | null; error: string | null } {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('requesting');
    void (async (): Promise<void> => {
      try {
        await ensureChannel();
        const granted = await ensurePermission();
        if (cancelled) return;
        if (!granted) { setStatus('denied'); return; }
        const resp = await Notifications.getDevicePushTokenAsync();
        if (cancelled) return;
        if (typeof resp.data !== 'string') { setStatus('unavailable'); return; }
        setToken(resp.data);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return (): void => { cancelled = true; };
  }, []);

  return { status, token, error };
}

/** Ensure the 'xmtp' channel exists and POST_NOTIFICATIONS is granted. Shared
 *  with the foreground local-notification path in lib/pushRegister.ts. Returns
 *  true when the device is ready to display a notification. */
export async function ensureNotificationReady(): Promise<boolean> {
  await ensureChannel();
  return ensurePermission();
}

/** Magic prefix marking a plain-text XMTP message as a private control payload
 *  rather than a chat message. Re-exported from pushRegister so the channels
 *  list / conversation view can suppress these from the UI without importing the
 *  XMTP-client-typed module. */
export { isMetroControlBody } from './pushRegister';
