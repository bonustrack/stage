import type { Client } from '@xmtp/browser-sdk';
import { createClientSlot, resetSharedXmtpState } from './xmtp.state.core';

const slot = createClientSlot<Client<unknown>>(resetSharedXmtpState, (client) => { client.close(); });

export const getCachedXmtpClient = slot.get;
export const getOrCreateCachedClient = slot.getOrCreate;
export const waitForXmtpReady = slot.waitForReady;
export const resetClientScopedState = slot.reset;
