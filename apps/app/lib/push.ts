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

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Banner + sound even when the app is in the foreground. expo-notifications
 *  defaults to suppressing both. Set globally so it applies regardless of which
 *  screen is mounted when the push arrives. */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    /** Foreground de-dup: while the app runs, the channels-list stream posts its
     *  OWN local notification for each inbound message (tagged data.kind ===
     *  'xmtp-inbound'). This handler ALSO runs for the daemon's REMOTE FCM push
     *  for that same message — showing both is the duplicate the user saw. So in
     *  the foreground we only surface our local notif and suppress the remote
     *  banner. In the BACKGROUND this handler doesn't run, so the OS still shows
     *  the remote push — no notification is lost. */
    const isLocal = (notification.request?.content?.data as { kind?: string } | undefined)?.kind === 'xmtp-inbound';
    return {
      shouldShowBanner: isLocal,
      shouldShowList: isLocal,
      shouldPlaySound: isLocal,
      shouldSetBadge: true,
    };
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

/** Ensure the 'xmtp' channel exists and POST_NOTIFICATIONS is granted. Shared
 *  with the foreground local-notification path in lib/pushRegister.ts. Returns
 *  true when the device is ready to display a notification. */
export async function ensureNotificationReady(): Promise<boolean> {
  await ensureChannel();
  return ensurePermission();
}

/** Public re-exports from the XMTP-client-typed `pushRegister` module so callers
 *  import the whole push surface from one place (`lib/push`):
 *   - `isMetroControlBody`     — suppress control DMs in list / conversation UI
 *     (no XMTP-client import needed at the call site).
 *   - `registerPushWithDaemon` — auto-register the device token over an XMTP
 *     control DM (called from the client-ready / account-switch paths).
 *   - `presentInboundNotification` — foreground local notification (option b),
 *     called from the global message stream. */
export {
  isMetroControlBody,
  registerPushWithDaemon,
  presentInboundNotification,
  isDaemonPushRegistered,
} from './pushRegister';
