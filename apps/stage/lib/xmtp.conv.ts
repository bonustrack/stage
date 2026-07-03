
import { PublicIdentity, type Conversation } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(address, 'ETHEREUM'),
  );
  return dm.id;
}

export async function listRequestConvs(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAllConversations(['unknown']);
  } catch { }
  return client.conversations.list(undefined, undefined, ['unknown']).catch(() => []);
}

export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return await (conv as unknown as { consentState: () => Promise<XmtpConsent> }).consentState();
  } catch {
    return null;
  }
}

export async function acceptRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('allowed');
}

export async function blockRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('denied');
}

export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  const prefs = (client as unknown as {
    preferences?: { streamConsent?: (h: () => void) => Promise<{ end?: () => void } | (() => void)>; };
  })?.preferences;
  if (!prefs?.streamConsent) return () => undefined;
  let canceller: (() => void) | null = null;
  let cancelled = false;
  void prefs.streamConsent(() => { cb(); }).then(sub => {
    const stop = () => {
      const end = (sub as { end?: () => void }).end;
      if (typeof end === 'function') end.call(sub);
      else if (typeof sub === 'function') (sub)();
    };
    if (cancelled) { try { stop(); } catch { } return; }
    canceller = () => { try { stop(); } catch { } };
  }).catch(() => undefined);
  return () => { cancelled = true; canceller?.(); };
}

export async function syncConsent(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })?.preferences?.syncConsent?.();
  } catch { }
}
