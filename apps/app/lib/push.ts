/** Push-notification registration. Asks permission, obtains the Expo push token,
 * registers it with the metro daemon so messenger inbounds get pushed. */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { loadConfig, isConfigured } from './config';
import { sendMessenger } from './messenger';

/** True while the messenger tab is the foreground screen. Read by the notification
 *  handler to skip the heads-up banner + shade entry — the user can see the new
 *  message in the live feed anyway, no need to also dump it into the notif tray. */
let messengerActive = false;
export function setMessengerActive(active: boolean): void {
  messengerActive = active;
  if (active) void dismissAllMessengerNotifs();
}

/** Aggressive clear — Samsung's One UI sometimes ignores the bulk
 *  `dismissAllNotificationsAsync` for cross-process Expo pushes, so iterate
 *  presented notifications and dismiss each one explicitly. Also resets the
 *  app icon badge. Idempotent + best-effort. */
export async function dismissAllMessengerNotifs(): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presented.map(n =>
      Notifications.dismissNotificationAsync(n.request.identifier).catch(() => undefined),
    ));
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    await Notifications.setBadgeCountAsync(0).catch(() => undefined);
  } catch { /* swallow — clearing the tray shouldn'​t crash the app */ }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: !messengerActive,
    shouldShowList: !messengerActive,
    shouldPlaySound: false,
    shouldSetBadge: !messengerActive,
  }),
});

/** Notification category with an inline text-input action — quick-reply from the
 *  Android notification shade. The daemon's push payload sets
 *  `categoryId: 'messenger.reply'` to opt notifications into this action. */
const REPLY_CATEGORY = 'messenger.reply';
let categoryConfigured = false;
let responseListener: Notifications.EventSubscription | null = null;

async function configureReplyCategory(): Promise<void> {
  if (categoryConfigured) return;
  await Notifications.setNotificationCategoryAsync(REPLY_CATEGORY, [
    {
      identifier: 'reply',
      buttonTitle: 'Reply',
      textInput: { submitButtonTitle: 'Send', placeholder: 'Type a reply…' },
      /** Don't yank the user into the app — Android delivers the response via the
       *  registered listener while the app stays in background. */
      options: { opensAppToForeground: false },
    },
  ]);
  categoryConfigured = true;
}

/** Attach the global response listener once (idempotent). When the user submits
 *  text in the Reply action, fire a `sendMessenger` call with `replyTo` set to
 *  the originating message so the agent can thread the answer. */
export function attachReplyHandler(): void {
  if (responseListener) return;
  responseListener = Notifications.addNotificationResponseReceivedListener((resp) => {
    if (resp.actionIdentifier !== 'reply') return;
    const userText = ((resp as unknown as { userText?: string }).userText ?? '').trim();
    if (!userText) return;
    const data = resp.notification.request.content.data as { replyTo?: string } | undefined;
    const replyTo = data?.replyTo;
    void loadConfig().then(cfg => {
      if (!cfg || !isConfigured(cfg)) return undefined;
      return sendMessenger(cfg.daemonUrl, cfg.token, userText, [], replyTo);
    }).catch(() => { /* best-effort — a notification reply shouldn'​t crash the app */ });
  });
}

export async function registerForPush(daemonUrl: string, token: string): Promise<{ pushToken: string } | { error: string }> {
  if (!Device.isDevice) return { error: 'Push only works on a real device.' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messenger', {
      name: 'Messenger',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FFFFFF',
    });
  }
  await configureReplyCategory();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return { error: 'Permission denied' };

  const projectId = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenData.data;

  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pushToken }),
  });
  if (!res.ok) return { error: `daemon ${res.status}` };
  return { pushToken };
}
