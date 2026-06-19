/**
 * @file Public JS API for the Android-only MetroPill native module that hosts the custom FCM service, feeding it seen/duplicate-suppression state for rich foreground push notifications and degrading to no-ops when the native module isn't linked.
 */
import { Platform } from 'react-native';

import nativeModule from './src/MetroPillModule';

/**
 * Resolved native module — `null` when not linked on this platform/build
 *  (iOS, web, or a dev client built before this module shipped). The import
 *  resolves to null defensively (see src/MetroPillModule.ts). Android-only;
 *  forced to null off-Android so the public API no-ops cleanly.
 */
const native = Platform.OS === 'android' ? nativeModule : null;

/** Whether the native module is linked on this platform/build. */
export function isAvailable(): boolean {
  return native != null;
}

/**
 * Report the conversation the user is currently viewing so the native FCM
 *  service suppresses a push for it (the user has already seen the message).
 *  Pass null to clear (on blur / background). No-op when the module isn't
 *  linked — suppression simply never engages on older builds.
 */
export function setActiveConversation(convId: string | null): boolean {
  return native?.setActiveConversation?.(convId) ?? false;
}

/**
 * Report whether the app is currently foregrounded. While true the native FCM
 *  service skips its generic "New message" card so the JS layer can post a RICH
 *  local notification (real sender + preview) from the live decrypted stream
 *  with no duplicate. Set true on AppState 'active', false on background. No-op
 *  when the module isn't linked (rich foreground notifs simply never engage).
 */
export function setAppForeground(foreground: boolean): boolean {
  return native?.setAppForeground?.(foreground) ?? false;
}

/** Routing-only payload carried by the native `onXmtpPush` event. All fields are optional (the daemon's contentless push may omit any of them); they're used only to target the resync, never rendered. */
export interface XmtpPushEvent {
  line?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

/**
 * Subscribe to the native `onXmtpPush` event, fired by MetroFcmService on every
 *  contentless xmtp push BEFORE its card-suppression early-returns — so it wakes
 *  JS even when foregrounded / already viewing the conv. This is the real-time
 *  delivery signal that replaces the removed periodic poll: the FCM push is the
 *  one wake that reliably reaches the device when the MLS stream has silently
 *  died. No-op (returns a noop unsubscribe) when the module isn't linked.
 */
export function subscribeXmtpPush(cb: (e: XmtpPushEvent) => void): () => void {
  const sub = native?.addListener?.('onXmtpPush', cb);
  return () => { try { sub?.remove?.(); } catch { /* ignore */ } };
}
