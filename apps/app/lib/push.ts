/** @file Single-import barrel for the XMTP push surface, re-exporting the background daemon-registration and foreground local-notification helpers from `pushRegister`. */

/** Two delivery paths: background daemon FCM push (this device registers its token via a `register-push` control DM) and foreground local notifications from the global message stream; the barrel re-exports the whole push surface. */

/** Device-token helpers (getDeviceFcmToken / ensureNotificationReady) live in lib/push.device.ts; import them from there directly. */

/** Re-exports from `pushRegister` so callers get the whole push surface from `lib/push`: control-DM suppression, device-token auto-registration, and the foreground inbound-notification presenter. */
export {
  isMetroControlBody,
  registerPushWithDaemon,
  unregisterPushFromDaemon,
  presentInboundNotification,
  usePushDeepLinks,
} from './pushRegister';
