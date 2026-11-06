import type { Client } from '@xmtp/browser-sdk';
import { createClientSlot, resetSharedXmtpState } from './xmtp.state.core';

export const clientSlot = createClientSlot<Client<unknown>>(resetSharedXmtpState, (client) => {
  client.close();
});

export const getCachedXmtpClient = clientSlot.get;
export const waitForXmtpReady = clientSlot.waitForReady;
