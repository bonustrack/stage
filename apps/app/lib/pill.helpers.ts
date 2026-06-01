/** Internal helpers for lib/pill.ts — avatar caching, active-target state, the
 *  unread-badge sync, and the recorded-audio bridge wiring.
 *
 *  Extracted from pill.ts (mechanical split, behavior identical). Module-level
 *  state (`activeTarget`, `badgeUnsub`, `installed`) lives here so the public
 *  API wrappers in pill.ts share a single source of truth. */
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
import { isPillAvailable } from './pill.platform';

/** Download an avatar `url` to a cache file (keyed by `key`) and return a RAW
 *  filesystem path (or null on failure → native falls back to a neutral circle /
 *  the app icon). The native side decodes with `BitmapFactory.decodeFile`, which
 *  needs a raw path (`/data/user/0/.../x.png`), NOT a `file://` uri — a uri
 *  decodes to null → the green fallback circle. We strip the scheme here (mirrors
 *  `ensureDbDir` in lib/xmtp.ts) so native always gets a path it can read. */
export async function cacheAvatarFile(url: string | null, key: string): Promise<string | null> {
  if (!url) return null;
  try {
    const dest = new File(Paths.cache, `avatar-${key}.png`);
    if (dest.exists) try { dest.delete(); } catch { /* overwrite */ }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('cacheAvatarFile: fetch failed', url, res.status);
      return null;
    }
    const blob = await res.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    dest.create();
    dest.write(buf);
    // Verify the bytes actually landed before handing native a path.
    if (!dest.exists) {
      console.warn('cacheAvatarFile: write produced no file', dest.uri);
      return null;
    }
    // RAW path, no `file://` scheme — BitmapFactory.decodeFile needs it raw.
    return dest.uri.replace(/^file:\/+/, '/');
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

export function setActiveTarget(t: PillTarget | null): void { activeTarget = t; }

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
export function resolveTargetAvatarUrl(address: string): string {
  return avatarRenderUrl(address, getPeerAvatar(address), 120);
}

/** Resolve + cache the active target's avatar to a local file path. */
export async function cacheTargetAvatar(address: string): Promise<string | null> {
  return cacheAvatarFile(resolveTargetAvatarUrl(address), `pill-${address.toLowerCase()}`);
}

/** Subscribe to the channels cache and push the active target's unread count to
 *  the native badge whenever it changes. Best-effort: the convId is resolved
 *  async; until then the initial badge passed to showPill stands. */
export function startBadgeSync(address: string): void {
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

export function stopBadgeSync(): void {
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
  // `?focus=1` → the DM screen auto-focuses the composer + raises the keyboard
  // on arrival (the user tapped "open chat" → they're about to type).
  navigateToUrl(`${lineOfConv(convId)}?focus=1`);
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
