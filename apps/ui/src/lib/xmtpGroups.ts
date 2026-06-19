/**
 * @file Group/DM creation helpers against the Metro API, plus related member and endpoint constants.
 */
/** Group / DM creation against the Metro API + related constants. Split out of `xmtp.ts` so each file stays under the lint cap; re-exported from there. */

import { IdentifierKind } from '@xmtp/browser-sdk';
import { getOrCreateXmtpClient } from './xmtp';

/** Hardcoded co-members for the "Ask a question" group: claude (the daemon's XMTP identity) + Less (the project owner). The local wallet is added implicitly as the creator. */
export const ASK_QUESTION_MEMBERS = [
  '0x0bA043c6F25085C68042bad079c29bD8f16a651A', // claude (daemon xmtp train)
  '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5', // Less
] as const;

/** Base URL of the Metro API (daemon-backed). */
export const METRO_API_URL = 'https://api.metro.box';

/**
 * Create the "Ask a question" group via the Metro API so the *daemon* owns it
 *  (daemon = super-admin) and the local user joins as a plain member — rather
 *  than the user creating + owning it client-side. The daemon adds us by
 *  address; we sync the conversation list so the new group resolves locally,
 *  then return its id for navigation.
 */
export async function createAskQuestionGroup(): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const selfAddr = client.accountIdentifier?.identifier.toLowerCase() ?? '';
  if (!selfAddr) throw new Error('No local XMTP address available.');
  const res = await fetch(`${METRO_API_URL}/ask-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: selfAddr }),
  });
  const json = await res.json().catch(() => ({})) as { conversationId?: string; error?: string };
  if (!res.ok || !json.conversationId) {
    throw new Error(json.error ?? `Could not start the conversation (${res.status}).`);
  }
  /** The daemon created the group + added us; pull it into the local store so navigation + the conversation view find it immediately. */
  await client.conversations.sync().catch(() => undefined);
  return json.conversationId;
}

/** Find or create a DM with a peer by Ethereum address. Returns the conv id ready to push into `/xmtp/:convId`. */
export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}
