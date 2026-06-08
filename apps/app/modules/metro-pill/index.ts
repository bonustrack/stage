/** Public JS API for the MetroPill native module. Scoped to push-notification
 *  plumbing: the native module hosts the custom FCM service (rich foreground
 *  notifications), and these calls feed it the state to suppress duplicate /
 *  already-seen pushes.
 *
 *  Android-only. Every entry point degrades gracefully when the native module
 *  isn't linked (iOS, web, or a dev client built before this module shipped):
 *  `isAvailable()` returns false and the action no-ops. */
import { Platform } from 'react-native';

import nativeModule from './src/MetroPillModule';

/** Resolved native module — `null` when not linked on this platform/build
 *  (iOS, web, or a dev client built before this module shipped). The import
 *  resolves to null defensively (see src/MetroPillModule.ts). Android-only;
 *  forced to null off-Android so the public API no-ops cleanly. */
const native = Platform.OS === 'android' ? nativeModule : null;

/** Whether the native module is linked on this platform/build. */
export function isAvailable(): boolean {
  return native != null;
}

/** Report the conversation the user is currently viewing so the native FCM
 *  service suppresses a push for it (the user has already seen the message).
 *  Pass null to clear (on blur / background). No-op when the module isn't
 *  linked — suppression simply never engages on older builds. */
export function setActiveConversation(convId: string | null): boolean {
  return native?.setActiveConversation?.(convId) ?? false;
}

/** Report whether the app is currently foregrounded. While true the native FCM
 *  service skips its generic "New message" card so the JS layer can post a RICH
 *  local notification (real sender + preview) from the live decrypted stream
 *  with no duplicate. Set true on AppState 'active', false on background. No-op
 *  when the module isn't linked (rich foreground notifs simply never engage). */
export function setAppForeground(foreground: boolean): boolean {
  return native?.setAppForeground?.(foreground) ?? false;
}
