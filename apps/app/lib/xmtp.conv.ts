/** @file Conversation discovery (e.g. open-DM-by-address) plus message-request/consent helpers for the XMTP client lib, extracted from lib/xmtp.ts and re-exported there; `convOfLine` itself lives in xmtp.client.ts. */

import { PublicIdentity, type Conversation } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

/** Find or create a DM with a peer by Ethereum address. Returns the conv id ready to push into `/xmtp/[convId]`. Used from the per-user profile page'​s "Open chat" button. */
export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(address, 'ETHEREUM'),
  );
  return dm.id;
}

/** Message-requests: a conversation whose consent is `'unknown'` is pending (channels list shows only `'allowed'`); the Requests screen lists them with Accept→`'allowed'` (into the inbox) / Block→`'denied'` (out of both), cross-device via XMTP synced consent. */
export async function listRequestConvs(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAllConversations(['unknown']);
  } catch { /* best-effort — fall back to whatever's local */ }
  return client.conversations.list(undefined, undefined, ['unknown']).catch(() => []);
}

/** Read a single conversation's current consent state (allowed/denied/unknown) for the in-channel request action bar to decide if it's still pending; returns null if the conversation can't be resolved. */
export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return await (conv as unknown as { consentState: () => Promise<XmtpConsent> }).consentState();
  } catch {
    return null;
  }
}

/** Accept a pending message request: set consent to `'allowed'` so it moves from the Requests list into the main inbox. */
export async function acceptRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('allowed');
}

/** Block/decline a pending message request: set consent to `'denied'` so it drops out of both the Requests list and the main inbox. */
export async function blockRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('denied');
}

/** Subscribe to live consent-state changes so the channels and Requests lists reconcile when a conv is accepted/blocked elsewhere; returns an unsubscribe fn and is a best-effort no-op if the SDK build lacks `streamConsent`. */
export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  const prefs = (client as unknown as {
    preferences?: { streamConsent?: (h: () => void) => Promise<{ end?: () => void } | (() => void)>; };
  })?.preferences;
  if (!prefs?.streamConsent) return () => undefined;
  let canceller: (() => void) | null = null;
  let cancelled = false;
  void prefs.streamConsent(() => { cb(); }).then(sub => {
    /** Stop helper. */
    const stop = () => {
      const end = (sub as { end?: () => void }).end;
      if (typeof end === 'function') end.call(sub);
      else if (typeof sub === 'function') (sub)();
    };
    if (cancelled) { try { stop(); } catch { /* ignore */ } return; }
    canceller = () => { try { stop(); } catch { /* ignore */ } };
  }).catch(() => undefined);
  return () => { cancelled = true; canceller?.(); };
}

/** Pull synced consent updates from the network into the local DB. Call on app foreground so accept/block done on another device lands here. */
export async function syncConsent(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })?.preferences?.syncConsent?.();
  } catch { /* best-effort */ }
}
