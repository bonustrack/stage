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
 *  Device-token acquisition lives in lib/push.device.ts (a leaf with no XMTP
 *  imports) so lib/pushRegister.ts can share it without a module cycle. This
 *  module re-exports the whole push surface so callers import it from one place. */

/** Device-token helpers (getDeviceFcmToken / ensureNotificationReady) live in
 *  lib/push.device.ts; import them from there directly. */

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
  unregisterPushFromDaemon,
  presentInboundNotification,
  usePushDeepLinks,
} from './pushRegister';
