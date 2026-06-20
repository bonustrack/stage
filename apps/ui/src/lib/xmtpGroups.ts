
import { IdentifierKind } from '@xmtp/browser-sdk';
import { getOrCreateXmtpClient } from './xmtp';

export const ASK_QUESTION_MEMBERS = [
  '0x0bA043c6F25085C68042bad079c29bD8f16a651A',
  '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5',
] as const;

export const METRO_API_URL = 'https://api.metro.box';

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
  await client.conversations.sync().catch(() => undefined);
  return json.conversationId;
}

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}
