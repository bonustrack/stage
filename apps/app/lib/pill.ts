/** JS controller for the MetroPill native module — floating audio pill +
 *  Android Bubbles, wired to the existing XMTP audio-send pipeline.
 *
 *  Android-only; every entry point degrades gracefully on other platforms /
 *  on a dev client built before the native module shipped (`MetroPill.isAvailable()`
 *  returns false → the UI hides the affordance + a toast explains).
 *
 *  The pill is PER-PERSON: `showPill` is launched for a specific target
 *  (address + avatar), and that target is tracked in module state. The
 *  recorded-audio bridge sends the clip to the ACTIVE target's DM (not a
 *  hardcoded daemon), the "open chat" action opens that target's DM, and the
 *  unread badge tracks that target's conversation.
 *
 *  Internals (avatar caching, active-target state, badge sync, audio bridge)
 *  live in pill.helpers.ts; platform-availability checks in pill.platform.ts —
 *  split out for the <200-line lint cap. Public symbols are re-exported here so
 *  existing import paths keep working. */
import { lineOfConv } from './xmtp';
import { flash } from './toast';
import * as MetroPill from '../modules/metro-pill';
import {
  isPillAvailable, isBubblesSupported, hasOverlayPermission, isPillVisible,
} from './pill.platform';
import {
  cacheAvatarFile, cacheTargetAvatar, resolveTargetAvatarUrl,
  setActiveTarget, startBadgeSync, stopBadgeSync, installPillAudioBridge,
} from './pill.helpers';

export { isPillAvailable, isBubblesSupported, hasOverlayPermission, isPillVisible };
export { installPillAudioBridge };

/** Open a 1-1 DM as a floating Android Bubble. Downloads the peer avatar to a
 *  cache file first (the native side needs a local bitmap, not an https url).
 *  Returns false + flashes a toast when the native module isn't available. */
export async function openConversationAsBubble(args: {
  convId: string;
  peerName: string;
  peerAddress?: string | null;
}): Promise<boolean> {
  if (!isPillAvailable()) {
    flash('Bubbles need a newer app build');
    return false;
  }
  if (!MetroPill.isBubblesSupported()) {
    flash('Bubbles are off for this app (enable in system settings)');
    return false;
  }
  const url = args.peerAddress ? resolveTargetAvatarUrl(args.peerAddress) : null;
  const avatarUri = await cacheAvatarFile(url, args.peerAddress?.toLowerCase() ?? 'bubble');
  try {
    await MetroPill.openAsBubble({
      convId: args.convId,
      title: args.peerName,
      deepLink: lineOfConv(args.convId),
      avatarUri,
    });
    return true;
  } catch (e) {
    flash('Couldn’t open bubble');
    console.warn('openAsBubble failed', e);
    return false;
  }
}

/** Request the SYSTEM_ALERT_WINDOW permission (opens the system settings page;
 *  no callback — re-poll `hasOverlayPermission()` on resume). */
export async function requestOverlayPermission(): Promise<void> {
  if (!isPillAvailable()) return;
  await MetroPill.requestOverlayPermission();
}

/** Show the floating pill targeting a specific PERSON. The collapsed pill shows
 *  that person's avatar; pressing-to-talk sends them a voice clip; the badge
 *  tracks their DM's unread count. Downloads the avatar to a cache file first so
 *  the native side has a local bitmap. Resolves false if unavailable or the
 *  overlay permission is missing. */
export async function showPill(
  targetAddress: string,
  avatarPath?: string | null,
  initialUnread = 0,
): Promise<boolean> {
  if (!isPillAvailable()) {
    flash('Floating pill needs a newer app build');
    return false;
  }
  if (!MetroPill.hasOverlayPermission()) {
    flash('Grant “Display over other apps” first');
    return false;
  }
  // Track the active target; resolve the DM conv id lazily on first use.
  setActiveTarget({ address: targetAddress, convId: null });
  // Caller may pass a pre-cached avatar path; otherwise resolve it here.
  const path = avatarPath ?? (await cacheTargetAvatar(targetAddress));
  const ok = MetroPill.showPill(path, Math.max(0, initialUnread));
  if (ok) startBadgeSync(targetAddress);
  return ok;
}

export function hidePill(): boolean {
  if (!isPillAvailable()) return false;
  stopBadgeSync();
  setActiveTarget(null);
  return MetroPill.hidePill();
}
