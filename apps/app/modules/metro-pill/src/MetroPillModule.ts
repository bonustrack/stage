import { NativeModule, requireNativeModule } from 'expo-modules-core';

import type { MetroPillModuleEvents } from './MetroPill.types';

/** Typed handle to the native `MetroPill` Expo module (Android-only). */
declare class MetroPillModule extends NativeModule<MetroPillModuleEvents> {
  /** Whether the app currently holds the SYSTEM_ALERT_WINDOW permission. */
  hasOverlayPermission(): boolean;
  /** Opens the system "Display over other apps" Settings page. No callback —
   *  re-poll `hasOverlayPermission()` on app resume. */
  requestOverlayPermission(): Promise<void>;
  /** Whether the overlay foreground service is currently running. */
  isPillVisible(): boolean;
  /** Starts the overlay foreground service + shows the pill. The collapsed pill
   *  renders the avatar at `avatarPath` (a local file path) as a circle; pass
   *  null to use the neutral fallback circle. `badge` is the initial unread count
   *  drawn on the pill (0 hides it). Returns false if the overlay permission is
   *  missing (and emits `onError`). */
  showPill(avatarPath: string | null, badge: number): boolean;
  /** Update the unread-count badge on the live pill (0 hides it, >9 → "9+").
   *  No-op when the pill isn't currently showing. */
  setBadge(count: number): boolean;
  /** Hides the pill + stops the foreground service. */
  hidePill(): boolean;
  /** Whether Android Bubbles are supported + allowed (API 30+, channel/app
   *  bubble preference not disabled). */
  isBubblesSupported(): boolean;
  /** Posts a conversation shortcut + bubble notification for a 1-1 DM.
   *  `deepLink` is the `metro://xmtp/<convId>` link the bubble opens. */
  openAsBubble(convId: string, title: string, deepLink: string, avatarUri: string | null): Promise<void>;
  /** Report the conversation the user is currently viewing (bare convId) so the
   *  FCM service can suppress a push for it. Pass null to clear (on blur /
   *  background). Persisted to SharedPreferences so the FCM process can read it. */
  setActiveConversation(convId: string | null): boolean;
  /** Report whether the app is currently foregrounded so the FCM service can
   *  skip its generic card (the JS layer posts a rich one instead) and avoid a
   *  duplicate notification. Persisted to SharedPreferences for the FCM process. */
  setAppForeground(foreground: boolean): boolean;
}

// `requireNativeModule` throws on platforms where the module isn't linked
// (iOS / web / a dev client built before this module shipped). Resolve it
// defensively here and export `null` on failure so the public `index.ts` API
// can degrade gracefully without a top-level `require()`.
let resolved: MetroPillModule | null = null;
try {
  resolved = requireNativeModule<MetroPillModule>('MetroPill');
} catch {
  resolved = null;
}

export default resolved;
