/** Push-notification helper for the XMTP messenger.
 *
 *  The daemon-side xmtp train sends FCM v1 pushes whenever it emits an
 *  outbound message (claude → user). To receive them this device needs to:
 *
 *  1. Request POST_NOTIFICATIONS permission (Android 13+).
 *  2. Register the 'xmtp' notification channel the daemon targets.
 *  3. Fetch its raw FCM/APNs device token via expo-notifications.
 *
 *  The token is then displayed in the Profile tab — the user pastes it into
 *  `metro call xmtp register-push '{"token":"..."}'` on the daemon host to
 *  complete the pairing. */

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
