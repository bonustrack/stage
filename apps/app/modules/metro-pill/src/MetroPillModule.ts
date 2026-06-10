import { NativeModule, requireNativeModule } from 'expo-modules-core';

/** Typed handle to the native `MetroPill` Expo module (Android-only).
 *
 *  Scoped to the push-notification plumbing the custom FCM service reads. (The
 *  native binary may still expose the legacy floating-pill methods from an older
 *  build; the JS layer no longer declares or calls them.) */
/** Event map for the native module's `addListener`. `onXmtpPush` carries the
 *  contentless push's routing metadata so JS can target the resync. */
type MetroPillEvents = {
  onXmtpPush: (e: { line?: string | null; convId?: string | null; messageId?: string | null }) => void;
};

declare class MetroPillModule extends NativeModule<MetroPillEvents> {
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
