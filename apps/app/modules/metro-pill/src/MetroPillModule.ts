/** @file Typed handle to the native Android-only `MetroPill` Expo module, exposing the push-notification routing surface (including the `onXmtpPush` contentless-push event) the custom FCM service reads. */
import { NativeModule, requireNativeModule } from 'expo-modules-core';

/** Payload for the native `onXmtpPush` event: the contentless push's routing metadata so JS can target the resync. */
interface XmtpPushEvent {
  line?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

interface MetroPillEvents {
  /** Index signature so the shape satisfies expo's `EventsMap` constraint, which an interface alone lacks; the value type is the real event's listener signature and is assignable to the constraint, so this is type-safe, not a widening escape. */
  [event: string]: (e: XmtpPushEvent) => void;
  onXmtpPush: (e: XmtpPushEvent) => void;
}

declare class MetroPillModule extends NativeModule<MetroPillEvents> {
  /** Report the conversation the user is currently viewing (bare convId) so the FCM service can suppress a push for it. Pass null to clear (on blur / background). Persisted to SharedPreferences so the FCM process can read it. */
  setActiveConversation(convId: string | null): boolean;
  /** Report whether the app is currently foregrounded so the FCM service can skip its generic card (the JS layer posts a rich one instead) and avoid a duplicate notification. Persisted to SharedPreferences for the FCM process. */
  setAppForeground(foreground: boolean): boolean;
}

/** `requireNativeModule` throws where the module isn't linked (iOS/web/older dev client), so resolve it defensively here and export `null` on failure to let the public `index.ts` API degrade gracefully without a top-level `require()`. */
let resolved: MetroPillModule | null = null;
try {
  resolved = requireNativeModule<MetroPillModule>('MetroPill');
} catch {
  resolved = null;
}

export default resolved;
