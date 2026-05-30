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
import { useEffect } from 'react';
import { router } from 'expo-router';
import { ensureNotificationReady, getDeviceFcmToken } from './push';
import { markConvRead } from './channelsCache';

/** The daemon's XMTP identity (the `tony` daemon wallet) — the inbox the control
 *  DM is sent to. Same address used for the "Ask a question" group co-member. */
export const DAEMON_INBOX_ADDRESS = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';

/** Magic prefix marking a plain-text XMTP message as a private control payload
 *  rather than a chat message. The daemon parses the same prefix. */
export const METRO_CTRL_PREFIX = 'METRO_CTRL:';

/** The control-DM verb for push registration. Full body =
 *  `${METRO_CTRL_PREFIX}${CTRL_REGISTER_PUSH}:${json}`. */
const CTRL_REGISTER_PUSH = 'register-push';

/** Bump when the JSON shape below changes so the daemon can branch on `v`. */
const CTRL_SCHEMA_VERSION = 1;

/** Detect the magic-prefixed control body so the app filters these control DMs
 *  out of previews / rows / notifications. Kept deliberately broad (prefix only)
 *  so any future control verb is suppressed too. */
export function isMetroControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

/** Build the exact control-DM body the daemon will parse. Exposed for tests /
 *  the daemon side to share a single source of truth on the wire format. */
export function buildRegisterPushBody(payload: {
  token: string;
  platform: 'android' | 'ios';
  address: string;
  inboxId: string;
}): string {
  const json = JSON.stringify({
    v: CTRL_SCHEMA_VERSION,
    token: payload.token,
    platform: payload.platform,
    address: payload.address.toLowerCase(),
    inboxId: payload.inboxId,
  });
  return `${METRO_CTRL_PREFIX}${CTRL_REGISTER_PUSH}:${json}`;
}

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

/** Extract the conversation id a notification points at. Both the foreground
 *  local notif (`presentInboundNotification`, data.convId) and the daemon's
 *  remote FCM push carry the conv id in `data` — accept the common aliases the
 *  daemon may use (`convId` / `conversationId` / a `line` like
 *  `metro://xmtp/<acct>/<convId>`). Returns null when none is present. */
function convIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const direct = d.convId ?? d.conversationId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (typeof d.line === 'string') {
    // metro://xmtp/<account>/<convId>  → last non-empty path segment.
    const seg = d.line.replace(/[?#].*$/, '').split('/').filter(Boolean);
    const last = seg[seg.length - 1];
    if (last && last !== 'xmtp') return last;
  }
  return null;
}

/** Navigate to the conversation a tapped notification points at + clear its
 *  unread badge. Shared by the cold-start (getLastNotificationResponse) and
 *  warm (addNotificationResponseReceivedListener) paths. Best-effort. */
function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdFromNotificationData(response.notification?.request?.content?.data);
  if (!convId) return;
  router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  // Clearing unread is async + best-effort; the nav already happened.
  void markConvRead(convId).catch(() => undefined);
}

/** Install the notification-tap deep-link handler once for the app's lifetime.
 *  Mount in the root layout. Handles BOTH:
 *   - cold start: the app was launched by tapping a push while killed
 *     (`getLastNotificationResponseAsync`),
 *   - warm/background: a tap arrives while the app is alive/backgrounded
 *     (`addNotificationResponseReceivedListener`).
 *  On tap it routes to `/xmtp/[convId]` and calls `markConvRead` so the unread
 *  badge clears immediately. */
export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    // Cold-start: a tap that launched the app from killed state.
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => { if (!cancelled) openConvFromResponse(resp); })
      .catch(() => undefined);
    // Warm/background taps while the app is alive.
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
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
