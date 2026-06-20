/** @file XMTP-client-typed push helpers: debounced `registerPushWithDaemon`/`unregisterPushFromDaemon` control-DM token registration plus `presentInboundNotification` foreground local notifications de-duped against background FCM cards. */

/** Two delivery paths: background `registerPushWithDaemon` sends a control DM with the device FCM/APNs token (daemon fans out FCM), and foreground `presentInboundNotification` posts a local notif per inbound; wire format lives in pushRegister.control.ts. */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Client } from '@xmtp/react-native-sdk';
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { ensureNotificationReady, getDeviceFcmToken } from './push.device';
import { DAEMON_INBOX_ADDRESS, buildRegisterPushBody } from './pushRegister.control';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';

/** Re-export the control-DM wire-format surface (extracted into pushRegister.control.ts for the line cap) so existing import paths keep working. */
export { isMetroControlBody } from './pushRegister.control';
import { buildDisablePushBody } from './pushRegister.control';
/** Re-export the notification-tap deep-link handler (extracted for line cap). */
export { usePushDeepLinks } from './pushRegister.deeplink';

/** Debounce window gating re-send of the same (account, token) pairing; kept short (6h) so a server-side token wipe recovers on the next app open rather than staying push-dead, while still avoiding a re-register on every launch. */
const REGISTER_TTL_MS = 6 * 60 * 60 * 1000; /* 6 hours */
/** Last Register Key. */
const lastRegisterKey = (account: string): string => `push.register.${account}`;

/** Platform Tag. */
function platformTag(): 'android' | 'ios' | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null; /* web / unsupported — no device push token */
}

/** Minimal slice of the XMTP client we depend on; keeps the param typeable whether callers pass `Client` or a narrower mock. */
type PushClient = Pick<Client, 'inboxId' | 'publicIdentity' | 'conversations'>;

/** True when this exact (token) was registered for `stateKey` within REGISTER_TTL_MS, so registration can be skipped. */
async function isRecentlyRegistered(stateKey: string, token: string): Promise<boolean> {
  const prev = await AsyncStorage.getItem(stateKey).catch(() => null);
  if (!prev) return false;
  try {
    const { token: prevToken, at } = JSON.parse(prev) as { token: string; at: number };
    return prevToken === token && Date.now() - at < REGISTER_TTL_MS;
  } catch { return false; /* corrupt entry — re-register */ }
}

/** Send the register-push control DM to the daemon's inbox and persist the debounce state. */
async function sendRegisterControlDm(
  client: PushClient,
  args: { token: string; platform: 'android' | 'ios'; address: string; inboxId: string; stateKey: string },
): Promise<void> {
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(DAEMON_INBOX_ADDRESS, 'ETHEREUM'),
  );
  const body = buildRegisterPushBody({
    token: args.token, platform: args.platform, address: args.address, inboxId: args.inboxId,
  });
  await dm.send(body);
  await AsyncStorage.setItem(args.stateKey, JSON.stringify({ token: args.token, at: Date.now() }))
    .catch(() => undefined);
}

/** Auto-register this device's push token with the daemon for the client's account; fire-and-forget, debounced, never throws or blocks boot, and silently no-ops when there's no device token, permission is denied, it was registered within the TTL, or the control DM fails. */
export async function registerPushWithDaemon(client: PushClient): Promise<void> {
  try {
    const platform = platformTag();
    if (!platform) return;

    /** User-controlled kill switch (Settings → Notifications): when push is OFF we never (re-)register, so the daemon stops pushing for this device on the next token rotation / TTL expiry. */
    await loadPushEnabled();
    if (!isPushEnabledSync()) return;

    const address = client.publicIdentity?.identifier;
    const inboxId = client.inboxId;
    if (!address || !inboxId) return;

    /** Resolve the raw FCM/APNs device token (also ensures channel + permission). */
    const token = await getDeviceFcmToken();
    if (!token) return;

    const stateKey = lastRegisterKey(address.toLowerCase());
    if (await isRecentlyRegistered(stateKey, token)) return;

    await sendRegisterControlDm(client, { token, platform, address, inboxId, stateKey });
  } catch (err) {
    /** Best-effort: registration failure must never break app boot or messaging. */
    if (process.env.NODE_ENV !== 'production') {
      console.warn('registerPushWithDaemon failed', (err as Error).message);
    }
  }
}

/** Tell the daemon to STOP pushing to this device and clear the local registration state so the TTL gate treats it as unregistered; best-effort, and even if the control DM fails the local key is cleared so the next register won't re-send. */
export async function unregisterPushFromDaemon(client: PushClient): Promise<void> {
  try {
    const address = client.publicIdentity?.identifier;
    const inboxId = client.inboxId;
    if (!address || !inboxId) return;
    const account = address.toLowerCase();
    /** Drop the local debounce state so a future re-enable always re-registers. */
    const prev = await AsyncStorage.getItem(lastRegisterKey(account)).catch(() => null);
    await AsyncStorage.removeItem(lastRegisterKey(account)).catch(() => undefined);
    /** Best-effort: tell the daemon to forget this device's token (if we have one). */
    let token: string | null = null;
    if (prev) { try { token = (JSON.parse(prev) as { token?: string }).token ?? null; } catch { /* ignore */ } }
    if (!token) return;
    const dm = await client.conversations.findOrCreateDmWithIdentity(
      new PublicIdentity(DAEMON_INBOX_ADDRESS, 'ETHEREUM'),
    );
    await dm.send(buildDisablePushBody({ token, address, inboxId }));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('unregisterPushFromDaemon failed', (err as Error).message);
    }
  }
}

/** Message ids whose background push card the native FCM service already posted, tracked (and bounded) so a later foreground resync can't also post a rich local card for the same message and double-notify across the handoff. */
const bgDeliveredMsgIds = new Set<string>();
const BG_DELIVERED_MAX = 200;

/** Record that the native side delivered a background push card for this message id. Called from the `onXmtpPush` subscription whenever a push lands while the app is NOT foregrounded (i.e. the native generic card was shown). */
export function markBackgroundDelivered(messageId: string | null | undefined): void {
  if (!messageId) return;
  bgDeliveredMsgIds.add(messageId);
  if (bgDeliveredMsgIds.size > BG_DELIVERED_MAX) {
    const oldest = bgDeliveredMsgIds.values().next().value;
    if (oldest !== undefined) bgDeliveredMsgIds.delete(oldest);
  }
}

/** True (and consumes the id) when a background push card was already delivered for this message — so the foreground local notif must be suppressed. */
function consumeBackgroundDelivered(messageId: string | undefined): boolean {
  if (!messageId) return false;
  return bgDeliveredMsgIds.delete(messageId);
}

/** Present a foreground local notification for an inbound XMTP message on the 'xmtp' channel; de-duped against the background FCM path (skips when a background card already showed), carries convId/messageId in `data` for tap deep-linking, and never throws. */
export async function presentInboundNotification(args: {
  title: string;
  body: string;
  convId: string;
  messageId?: string;
}): Promise<void> {
  try {
    /** Background push already showed a card for this message — don't add a second one on foreground resync. */
    if (consumeBackgroundDelivered(args.messageId)) return;
    const ready = await ensureNotificationReady();
    if (!ready) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: 'default',
        data: { convId: args.convId, messageId: args.messageId ?? null, kind: 'xmtp-inbound' },
        ...(Platform.OS === 'android' ? { channelId: 'xmtp' } : {}),
      },
      trigger: null, /* present immediately */
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('presentInboundNotification failed', (err as Error).message);
    }
  }
}
