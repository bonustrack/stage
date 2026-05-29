/** JS controller for the MetroPill native module — floating audio pill +
 *  Android Bubbles, wired to the existing XMTP audio-send pipeline.
 *
 *  Android-only; every entry point degrades gracefully on other platforms /
 *  on a dev client built before the native module shipped (`MetroPill.isAvailable()`
 *  returns false → the UI hides the affordance + a toast explains).
 *
 *  The native module records audio to disk and emits `onRecorded` with a file
 *  uri. This module owns the single app-wide listener that takes that clip and
 *  sends it as an XMTP audio attachment to the daemon ("Tony") DM, reusing
 *  `xmtpSendAttachment` exactly like the composer's voice path. */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as MetroPill from '../modules/metro-pill';
import {
  openDmWithAddress, lineOfConv, fileUriToBase64, xmtpSendAttachment, getCachedXmtpClient,
} from './xmtp';
import { getPeerAvatar } from './peerProfiles';
import { DAEMON_INBOX_ADDRESS } from './pushRegister';
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
  const avatarUri = await cacheAvatarFile(args.peerAddress ?? null);
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

/** Download the peer's stamp.fyi avatar to a cache file and return a `file://`
 *  uri (or null on failure → native falls back to the app icon). */
async function cacheAvatarFile(address: string | null): Promise<string | null> {
  if (!address) return null;
  const url = getPeerAvatar(address);
  if (!url) return null;
  try {
    const dest = new File(Paths.cache, `bubble-avatar-${address.toLowerCase()}.png`);
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

/** Request the SYSTEM_ALERT_WINDOW permission (opens the system settings page;
 *  no callback — re-poll `hasOverlayPermission()` on resume). */
export async function requestOverlayPermission(): Promise<void> {
  if (!isPillAvailable()) return;
  await MetroPill.requestOverlayPermission();
}

/** Show the floating pill. Returns false if unavailable or the overlay
 *  permission is missing. */
export function showPill(): boolean {
  if (!isPillAvailable()) {
    flash('Floating pill needs a newer app build');
    return false;
  }
  if (!MetroPill.hasOverlayPermission()) {
    flash('Grant “Display over other apps” first');
    return false;
  }
  return MetroPill.showPill();
}

export function hidePill(): boolean {
  if (!isPillAvailable()) return false;
  return MetroPill.hidePill();
}

let installed = false;
/** Install the single app-wide recorded-audio listener. Idempotent. Call once
 *  from the root layout. A pill recording → XMTP audio message to the daemon DM. */
export function installPillAudioBridge(): () => void {
  if (!isPillAvailable() || installed) return () => undefined;
  installed = true;

  const recSub = MetroPill.addRecordedListener((e) => {
    void sendClipToDaemon(e.uri).catch((err) => {
      console.warn('pill clip send failed', err);
      flash('Voice clip failed to send');
    });
  });
  const errSub = MetroPill.addErrorListener((e) => {
    console.warn('MetroPill error', e.message);
  });
  // "Open chat" from the pill's expanded bar → route to the daemon ("Tony") DM.
  // The native side already foregrounded the app (launched MainActivity); here we
  // resolve the daemon convId (JS-only knowledge) and navigate to it.
  const openSub = MetroPill.addOpenChatListener(() => {
    void openDaemonChat().catch((err) => {
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

/** Resolve the daemon ("Tony") DM and navigate to it. The daemon convId is
 *  derived from its XMTP address (not known natively), so this lives JS-side. */
async function openDaemonChat(): Promise<void> {
  if (!getCachedXmtpClient()) {
    flash('Open Metro to chat with Tony');
    return;
  }
  const convId = await openDmWithAddress(DAEMON_INBOX_ADDRESS);
  navigateToUrl(lineOfConv(convId));
}

/** Send a recorded clip as an XMTP audio attachment to the daemon ("Tony") DM,
 *  reusing the composer's exact inline-attachment path. */
async function sendClipToDaemon(uri: string): Promise<void> {
  // Require a live XMTP client — the pill can fire while the app is backgrounded;
  // if the client isn't booted we surface a toast rather than silently dropping.
  if (!getCachedXmtpClient()) {
    flash('Open Metro to send the voice clip');
    return;
  }
  const convId = await openDmWithAddress(DAEMON_INBOX_ADDRESS);
  const line = lineOfConv(convId);
  const dataB64 = await fileUriToBase64(uri);
  await xmtpSendAttachment(line, `voice-${Date.now()}.m4a`, 'audio/m4a', dataB64);
  flash('Voice clip sent to Tony');
}
