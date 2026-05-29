/** Public JS API for the MetroPill native module.
 *
 *  Android-only. Every entry point degrades gracefully when the native module
 *  isn't linked (iOS, web, or a dev client built before this module shipped) so
 *  the app's JS keeps working — `isAvailable()` returns false and the action
 *  no-ops, letting callers show a toast instead of crashing.
 */
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';

import nativeModule from './src/MetroPillModule';
import type { RecordedEvent, PillErrorEvent } from './src/MetroPill.types';

export type { RecordedEvent, PillErrorEvent } from './src/MetroPill.types';

/** Resolved native module — `null` when not linked on this platform/build
 *  (iOS, web, or a dev client built before this module shipped). The import
 *  resolves to null defensively (see src/MetroPillModule.ts). Android-only;
 *  forced to null off-Android so the public API no-ops cleanly. */
const native = Platform.OS === 'android' ? nativeModule : null;

const NOOP_SUB: EventSubscription = { remove() { /* no-op */ } } as EventSubscription;

/** Whether the native module is linked on this platform/build. */
export function isAvailable(): boolean {
  return native != null;
}

export function hasOverlayPermission(): boolean {
  return native?.hasOverlayPermission() ?? false;
}

export async function requestOverlayPermission(): Promise<void> {
  await native?.requestOverlayPermission();
}

export function isPillVisible(): boolean {
  return native?.isPillVisible() ?? false;
}

/** Show the floating pill. Returns false if unavailable or permission missing. */
export function showPill(): boolean {
  return native?.showPill() ?? false;
}

export function hidePill(): boolean {
  return native?.hidePill() ?? false;
}

/** Whether Android Bubbles are supported + currently allowed. */
export function isBubblesSupported(): boolean {
  return native?.isBubblesSupported() ?? false;
}

/** Open a 1-1 conversation as a floating Android Bubble. No-op + resolves when
 *  the native module is unavailable (caller should `isAvailable()`-gate the UI). */
export async function openAsBubble(args: {
  convId: string;
  title: string;
  deepLink: string;
  avatarUri?: string | null;
}): Promise<void> {
  if (!native) return;
  await native.openAsBubble(args.convId, args.title, args.deepLink, args.avatarUri ?? null);
}

/** Subscribe to recorded-audio events from the pill. Returns a subscription
 *  whose `.remove()` detaches the listener. No-op subscription when unavailable. */
export function addRecordedListener(cb: (e: RecordedEvent) => void): EventSubscription {
  return native ? native.addListener('onRecorded', cb) : NOOP_SUB;
}

export function addErrorListener(cb: (e: PillErrorEvent) => void): EventSubscription {
  return native ? native.addListener('onError', cb) : NOOP_SUB;
}

export function addPillTappedListener(cb: () => void): EventSubscription {
  return native ? native.addListener('onPillTapped', cb) : NOOP_SUB;
}

/** Subscribe to the "open chat" action from the pill's expanded bar. The native
 *  side has already foregrounded the app; the handler routes to the daemon DM. */
export function addOpenChatListener(cb: () => void): EventSubscription {
  return native ? native.addListener('onOpenChat', cb) : NOOP_SUB;
}
