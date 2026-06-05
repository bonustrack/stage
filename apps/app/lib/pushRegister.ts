/** Push registration + foreground local-notification helpers (option b).
 *
 *  Lives separately from `lib/push.ts` because it imports the XMTP-client-typed
 *  surface (`@xmtp/react-native-sdk`); `lib/push.ts` stays free of that import so
 *  the channels-list / conversation view can pull `isMetroControlBody` without
 *  dragging the whole XMTP client into those modules. `lib/push.ts` re-exports
 *  the public symbols (`isMetroControlBody`, `presentInboundNotification`,
 *  `registerPushWithDaemon`) so callers import them from one place.
 *
 *  Two delivery paths:
 *  1. BACKGROUND push (daemon-run accounts). `registerPushWithDaemon` auto-
 *     registers this device's raw FCM/APNs token with the daemon by sending a
 *     PRIVATE XMTP control DM (magic-prefixed plain text) to the daemon's inbox;
 *     the daemon parses it, stores the token scoped to the account, and fans out
 *     FCM on inbound.
 *  2. FOREGROUND local notifications (any account, incl. phone-only wallets the
 *     daemon has no key for). While the app runs, the global XMTP stream calls
 *     `presentInboundNotification` per inbound message — no daemon involvement.
 *
 *  ─────────────────────────────────────────────────────────────────────────────
 *  CONTROL-DM WIRE FORMAT — the daemon train MUST parse the exact same thing.
 *  ─────────────────────────────────────────────────────────────────────────────
 *  The DM is a plain-text XMTP message (default content type, so no new codec)
 *  whose body is:
 *
 *      METRO_CTRL:register-push:{json}
 *
 *  where `{json}` is a single-line JSON object:
 *
 *      {
 *        "v": 1,                 // schema version
 *        "token": "<fcm/apns device token>",
 *        "platform": "android" | "ios",
 *        "address": "0x…",       // the phone's ACTIVE account address (lowercased)
 *        "inboxId": "<hex>"      // the phone's XMTP inboxId for that account
 *      }
 *
 *  Daemon side (to be added to ~/.metro/trains/xmtp.ts inbound handler):
 *   - Detect the body via the same prefix test as `isMetroControlBody`
 *     (startsWith `METRO_CTRL:`). When matched, do NOT surface it as a chat
 *     message / owner-feed event.
 *   - Split off `METRO_CTRL:register-push:` and `JSON.parse` the remainder.
 *   - Call the existing `register-push` storage logic with:
 *       token    = json.token
 *       platform = json.platform
 *       inboxId  = senderInboxId            (the phone's inbox — authoritative)
 *       account  = <the daemon accountId whose client received this DM>
 *     The daemon infers `account` from which of its own inboxes the DM arrived
 *     on, so the phone never needs to know the daemon's internal accountId — it
 *     only needs the daemon's address (DAEMON_INBOX_ADDRESS below). The
 *     `address`/`inboxId` in the payload are for verification + audit. */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Client } from '@xmtp/react-native-sdk';
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { ensureNotificationReady, getDeviceFcmToken } from './push.device';
import { DAEMON_INBOX_ADDRESS, buildRegisterPushBody } from './pushRegister.control';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';

// Re-export the control-DM wire-format surface so existing import paths keep
// working (extracted into pushRegister.control.ts for the <200-line cap).
export { DAEMON_INBOX_ADDRESS, METRO_CTRL_PREFIX, isMetroControlBody, buildRegisterPushBody } from './pushRegister.control';
import { buildDisablePushBody } from './pushRegister.control';
// Re-export the notification-tap deep-link handler (extracted for line cap).
export { usePushDeepLinks } from './pushRegister.deeplink';

/** Debounce: don't re-send the same (account, token) pairing more than once per
 *  window. A device switching accounts re-registers (different key); a token
 *  rotation re-registers (different value). */
// Kept deliberately short: if the server-side token is ever lost (e.g. a daemon
// FCM token wipe), this debounce is the only thing gating re-registration. A long
// TTL means the server stays token-less — and pushes stay dead — until the window
// elapses. 6h trades a little extra re-register traffic for fast recovery: the
// token is restored on the next app open within 6h of any server-side wipe, while
// still avoiding a re-register on every single launch.
const REGISTER_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const lastRegisterKey = (account: string): string => `push.register.${account}`;

function platformTag(): 'android' | 'ios' | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null; // web / unsupported — no device push token
}

/** Minimal slice of the XMTP client we depend on; keeps the param typeable
 *  whether callers pass `Client` or a narrower mock. */
type PushClient = Pick<Client, 'inboxId' | 'publicIdentity' | 'conversations'>;

/** Auto-register this device's push token with the daemon for the account the
 *  given client is logged into. Fire-and-forget + debounced — never throws,
 *  never blocks boot. Called on client-ready and on account switch.
 *
 *  No-ops (silently) when:
 *   - the platform delivers no device token (web / emulator w/o Play Services),
 *   - notification permission is denied,
 *   - the same (account, token) was registered within REGISTER_TTL_MS,
 *   - sending the control DM fails (best-effort; foreground notifs still work). */
export async function registerPushWithDaemon(client: PushClient): Promise<void> {
  try {
    const platform = platformTag();
    if (!platform) return;

    // User-controlled kill switch (Settings → Notifications). When push is
    // turned OFF we never (re-)register the token, so the daemon stops pushing
    // for this device on next token rotation / TTL expiry.
    await loadPushEnabled();
    if (!isPushEnabledSync()) return;

    const address = client.publicIdentity?.identifier;
    const inboxId = client.inboxId;
    if (!address || !inboxId) return;

    // Resolve the raw FCM/APNs device token (also ensures channel + permission).
    const token = await getDeviceFcmToken();
    if (!token) return;

    // Debounce by account+token: skip if we already registered this exact
    // pairing recently.
    const account = address.toLowerCase();
    const stateKey = lastRegisterKey(account);
    const prev = await AsyncStorage.getItem(stateKey).catch(() => null);
    if (prev) {
      try {
        const { token: prevToken, at } = JSON.parse(prev) as { token: string; at: number };
        if (prevToken === token && Date.now() - at < REGISTER_TTL_MS) return;
      } catch { /* corrupt entry — fall through and re-register */ }
    }

    // Send the private control DM to the daemon's inbox.
    const dm = await client.conversations.findOrCreateDmWithIdentity(
      new PublicIdentity(DAEMON_INBOX_ADDRESS, 'ETHEREUM'),
    );
    const body = buildRegisterPushBody({ token, platform, address, inboxId });
    await dm.send(body);

    await AsyncStorage.setItem(stateKey, JSON.stringify({ token, at: Date.now() }))
      .catch(() => undefined);
  } catch (err) {
    // Best-effort: registration failure must never break app boot or messaging.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('registerPushWithDaemon failed', (err as Error).message);
    }
  }
}

/** True when `account` (lowercased address) has a live push registration with
 *  the daemon — i.e. `registerPushWithDaemon` succeeded for it within the TTL.
 *
 *  Used to gate the foreground JS local notification: if the daemon is pushing
 *  for this account, its data-push is rendered NATIVELY by MetroFcmService (the
 *  Telegram-style avatar card) in BOTH foreground and background. That native
 *  `notify()` does NOT pass through expo-notifications' setNotificationHandler,
 *  so it can't be suppressed JS-side — meaning if we ALSO post the JS local
 *  notif we get two cards (the duplicate the user saw). So when the daemon
 *  covers this account we skip the JS local notif entirely; phone-only accounts
 *  the daemon has no key for keep getting the JS local notif as their only path. */
export async function isDaemonPushRegistered(account: string): Promise<boolean> {
  try {
    const prev = await AsyncStorage.getItem(lastRegisterKey(account.toLowerCase()));
    if (!prev) return false;
    const { token, at } = JSON.parse(prev) as { token?: string; at?: number };
    return !!token && typeof at === 'number' && Date.now() - at < REGISTER_TTL_MS;
  } catch { return false; }
}

/** Tell the daemon to STOP pushing to this device and clear the local
 *  registration state so the TTL gate treats the device as unregistered. Called
 *  when the user turns push OFF in Settings → Notifications. Best-effort: even if
 *  the control DM fails, the local register-state key is cleared so the next
 *  `registerPushWithDaemon` (now gated by the OFF preference) won't re-send. */
export async function unregisterPushFromDaemon(client: PushClient): Promise<void> {
  try {
    const address = client.publicIdentity?.identifier;
    const inboxId = client.inboxId;
    if (!address || !inboxId) return;
    const account = address.toLowerCase();
    // Drop the local debounce state so a future re-enable always re-registers.
    const prev = await AsyncStorage.getItem(lastRegisterKey(account)).catch(() => null);
    await AsyncStorage.removeItem(lastRegisterKey(account)).catch(() => undefined);
    // Best-effort: tell the daemon to forget this device's token (if we have one).
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

/** Present a foreground local notification for an inbound XMTP message (option
 *  b). Called from the global message stream for messages that are NOT our own,
 *  NOT system/silent types, and NOT our own control DMs (the caller filters
 *  those). Posts on the 'xmtp' channel so it matches the daemon's FCM channel.
 *
 *  `convId` / `messageId` ride in `data` so a future notification-tap handler
 *  can deep-link into the conversation. Best-effort — never throws. */
export async function presentInboundNotification(args: {
  title: string;
  body: string;
  convId: string;
  messageId?: string;
}): Promise<void> {
  try {
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
      trigger: null, // present immediately
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('presentInboundNotification failed', (err as Error).message);
    }
  }
}
