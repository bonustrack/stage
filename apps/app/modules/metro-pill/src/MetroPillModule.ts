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
  /** Starts the overlay foreground service + shows the pill. Returns false if
   *  the overlay permission is missing (and emits `onError`). */
  showPill(): boolean;
  /** Hides the pill + stops the foreground service. */
  hidePill(): boolean;
  /** Whether Android Bubbles are supported + allowed (API 30+, channel/app
   *  bubble preference not disabled). */
  isBubblesSupported(): boolean;
  /** Posts a conversation shortcut + bubble notification for a 1-1 DM.
   *  `deepLink` is the `metro://xmtp/<convId>` link the bubble opens. */
  openAsBubble(convId: string, title: string, deepLink: string, avatarUri: string | null): Promise<void>;
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
