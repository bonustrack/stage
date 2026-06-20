/** @file Public JS API for the Android-only MetroPill native module hosting the custom FCM service, feeding it seen/duplicate-suppression state for rich foreground push notifications and degrading to no-ops when the native module isn't linked. */
import { Platform } from 'react-native';

import nativeModule from './src/MetroPillModule';

/** Resolved native module, `null` when not linked (iOS, web, or an older dev client) and forced to null off-Android so the public API no-ops cleanly. */
const native = Platform.OS === 'android' ? nativeModule : null;

/** Whether the native module is linked on this platform/build. */
export function isAvailable(): boolean {
  return native != null;
}

/** Report the conversation the user is currently viewing so the native FCM service suppresses its push; pass null to clear on blur/background. No-op when the module isn't linked. */
export function setActiveConversation(convId: string | null): boolean {
  return native?.setActiveConversation?.(convId) ?? false;
}

/** Report whether the app is foregrounded; while true the native FCM service skips its generic card so the JS layer can post a rich local notification (real sender + preview) with no duplicate. No-op when the module isn't linked. */
export function setAppForeground(foreground: boolean): boolean {
  return native?.setAppForeground?.(foreground) ?? false;
}

/** Routing-only payload carried by the native `onXmtpPush` event. All fields are optional (the daemon's contentless push may omit any of them); they're used only to target the resync, never rendered. */
export interface XmtpPushEvent {
  line?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

/** Subscribe to the native `onXmtpPush` event, fired on every contentless xmtp push before card-suppression so it wakes JS even when foregrounded — the real-time delivery signal that reliably reaches the device when the MLS stream silently died. Returns a noop unsubscribe when the module isn't linked. */
export function subscribeXmtpPush(cb: (e: XmtpPushEvent) => void): () => void {
  const sub = native?.addListener?.('onXmtpPush', cb);
  return () => { try { sub?.remove?.(); } catch { /* ignore */ } };
}
