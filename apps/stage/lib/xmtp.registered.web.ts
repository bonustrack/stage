import { Client, IdentifierKind } from '@xmtp/browser-sdk';
import { withMainThreadWasm } from './xmtp.wasm.web';

export async function isXmtpRegistered(address: string): Promise<boolean> {
  const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
  const result = await withMainThreadWasm(() => Client.canMessage([identifier], 'production'));
  return [...result.values()].some(Boolean);
}
