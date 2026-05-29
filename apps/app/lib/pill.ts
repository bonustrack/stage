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
 *  unread badge tracks that target's conversation. */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';
import * as MetroPill from '../modules/metro-pill';
import {
  openDmWithAddress, lineOfConv, fileUriToBase64, xmtpSendAttachment, getCachedXmtpClient,
  shortAddress,
} from './xmtp';
import { getPeerAvatar, getPeerName } from './peerProfiles';
import { getCachedRows, subscribeCachedRows } from './channelsCache';
import { flash } from './toast';
import { navigateToUrl } from './deepLinks';

/** Whether the native pill/bubble module is linked on this build. */
export function isPillAvailable(): boolean {
  return Platform.OS === 'android' && MetroPill.isAvailable();
}

/** Whether Android Bubbles are supported + currently allowed (API 30+). */
export function isBubblesSupported(): boolean {
  return isPillAvailable() && MetroPill.isBubblesSupported();
}

export function hasOverlayPermission(): boolean {
  return isPillAvailable() && MetroPill.hasOverlayPermission();
}

export function isPillVisible(): boolean {
  return isPillAvailable() && MetroPill.isPillVisible();
}

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

/** Download an avatar `url` to a cache file (keyed by `key`) and return a
 *  `file://` uri (or null on failure → native falls back to a neutral circle /
 *  the app icon). The native side needs a local bitmap, not an https url. */
async function cacheAvatarFile(url: string | null, key: string): Promise<string | null> {
  if (!url) return null;
  try {
    const dest = new File(Paths.cache, `avatar-${key}.png`);
    if (dest.exists) try { dest.delete(); } catch { /* overwrite */ }
    const blob = await (await fetch(url)).blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    dest.create();
    dest.write(buf);
    return dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`;
  } catch (e) {
    console.warn('cacheAvatarFile failed', e);
    return null;
  }
}

/** The person the floating pill is currently active for. `convId` is resolved
 *  lazily (first record / open / badge-sync) and memoised so we don't re-derive
 *  the DM on every action. `null` when no pill is showing. */
interface PillTarget {
  address: string;
  /** Cached DM conv id once resolved (for badge lookup). */
  convId: string | null;
}
let activeTarget: PillTarget | null = null;
/** Unsubscribe handle for the active target's unread-badge subscription. */
let badgeUnsub: (() => void) | null = null;

/** Resolve the active target's DM conv id (memoising it on the target so repeat
 *  actions are cheap). Requires a live XMTP client. */
async function resolveTargetConvId(t: PillTarget): Promise<string> {
  if (t.convId) return t.convId;
  const convId = await openDmWithAddress(t.address);
  t.convId = convId;
  return convId;
}

/** Resolve a target's avatar to a fetchable HTTP url: the custom Snapshot
 *  profile avatar if set (ipfs:// resolved), else the stamp.fyi identicon (which
 *  always 200s). Mirrors the `<Avatar>` component's resolution priority. */
function resolveTargetAvatarUrl(address: string): string {
  return avatarRenderUrl(address, getPeerAvatar(address), 120);
}

/** Resolve + cache the active target's avatar to a local file path. */
async function cacheTargetAvatar(address: string): Promise<string | null> {
  return cacheAvatarFile(resolveTargetAvatarUrl(address), `pill-${address.toLowerCase()}`);
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
  activeTarget = { address: targetAddress, convId: null };
  // Caller may pass a pre-cached avatar path; otherwise resolve it here.
  const path = avatarPath ?? (await cacheTargetAvatar(targetAddress));
  const ok = MetroPill.showPill(path, Math.max(0, initialUnread));
  if (ok) startBadgeSync(targetAddress);
  return ok;
}

export function hidePill(): boolean {
  if (!isPillAvailable()) return false;
  stopBadgeSync();
  activeTarget = null;
  return MetroPill.hidePill();
}

/** Subscribe to the channels cache and push the active target's unread count to
 *  the native badge whenever it changes. Best-effort: the convId is resolved
 *  async; until then the initial badge passed to showPill stands. */
function startBadgeSync(address: string): void {
  stopBadgeSync();
  let convId: string | null = null;
  const push = (): void => {
    if (!convId) return;
    const rows = getCachedRows();
    const row = rows?.find(r => r.convId === convId);
    MetroPill.setBadge(row ? Math.max(0, row.unreadCount) : 0);
  };
  // Resolve the DM conv id once, then push the current count + on every change.
  void (async (): Promise<void> => {
    if (!getCachedXmtpClient()) return;
    try {
      convId = await openDmWithAddress(address);
      if (activeTarget?.address === address) activeTarget.convId = convId;
      push();
    } catch (e) {
      console.warn('pill badge sync: convId resolve failed', e);
    }
  })();
  badgeUnsub = subscribeCachedRows(() => push());
}

function stopBadgeSync(): void {
  badgeUnsub?.();
  badgeUnsub = null;
}

let installed = false;
/** Install the single app-wide recorded-audio listener. Idempotent. Call once
 *  from the root layout. A pill recording → XMTP audio message to the ACTIVE
 *  target's DM. */
export function installPillAudioBridge(): () => void {
  if (!isPillAvailable() || installed) return () => undefined;
  installed = true;

  const recSub = MetroPill.addRecordedListener((e) => {
    void sendClipToTarget(e.uri).catch((err) => {
      console.warn('pill clip send failed', err);
      flash('Voice clip failed to send');
    });
  });
  const errSub = MetroPill.addErrorListener((e) => {
    console.warn('MetroPill error', e.message);
  });
  // "Open chat" from the pill's expanded bar → route to the ACTIVE target's DM.
  // The native side already foregrounded the app (launched MainActivity); here we
  // resolve the target's convId (JS-only knowledge) and navigate to it.
  const openSub = MetroPill.addOpenChatListener(() => {
    void openTargetChat().catch((err) => {
      console.warn('pill openChat failed', err);
      flash('Couldn’t open chat');
    });
  });

  return () => {
    installed = false;
    recSub.remove();
    errSub.remove();
    openSub.remove();
  };
}

/** A short label for the active target (display name, else short address). */
function targetLabel(address: string): string {
  return getPeerName(address) ?? shortAddress(address);
}

/** Resolve the active target's DM and navigate to it. */
async function openTargetChat(): Promise<void> {
  const t = activeTarget;
  if (!t) return;
  if (!getCachedXmtpClient()) {
    flash('Open Metro to chat');
    return;
  }
  const convId = await resolveTargetConvId(t);
  navigateToUrl(lineOfConv(convId));
}

/** Send a recorded clip as an XMTP audio attachment to the ACTIVE target's DM,
 *  reusing the composer's exact inline-attachment path. */
async function sendClipToTarget(uri: string): Promise<void> {
  const t = activeTarget;
  if (!t) return;
  // Require a live XMTP client — the pill can fire while the app is backgrounded;
  // if the client isn't booted we surface a toast rather than silently dropping.
  if (!getCachedXmtpClient()) {
    flash('Open Metro to send the voice clip');
    return;
  }
  const convId = await resolveTargetConvId(t);
  const line = lineOfConv(convId);
  const dataB64 = await fileUriToBase64(uri);
  await xmtpSendAttachment(line, `voice-${Date.now()}.m4a`, 'audio/m4a', dataB64);
  flash(`Voice clip sent to ${targetLabel(t.address)}`);
}
