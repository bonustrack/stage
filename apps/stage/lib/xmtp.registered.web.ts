import { Client, IdentifierKind } from '@xmtp/browser-sdk';

export async function isXmtpRegistered(address: string): Promise<boolean> {
  const result = await Client.canMessage([{ identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }], 'production');
  return [...result.values()].some(Boolean);
}
