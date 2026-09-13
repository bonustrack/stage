
import type { Client } from '@xmtp/react-native-sdk';
import { resetSharedXmtpState } from './xmtp.state.core';

let cachedClient: Client | null = null;

export function getCachedXmtpClient(): Client | null { return cachedClient; }
export function setCachedXmtpClient(client: Client | null): void { cachedClient = client; }

export async function waitForXmtpReady(capMs = 60_000): Promise<boolean> {
  if (cachedClient) return true;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (cachedClient) return true;
  }
  return false;
}

export { inboxEthCache, feedCache, activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state.core';

export function resetClientScopedState(): void {
  cachedClient = null;
  resetSharedXmtpState();
}
