import type { Client } from '@xmtp/react-native-sdk';
import { createClientSlot } from './storeCore';
import { resetSharedXmtpState } from './xmtp.state.core';

const slot = createClientSlot<Client>(resetSharedXmtpState);

export const getCachedXmtpClient = slot.get;
export const setCachedXmtpClient = slot.set;
export const getOrCreateCachedClient = slot.getOrCreate;
export const waitForXmtpReady = slot.waitForReady;
export const resetClientScopedState = slot.reset;
