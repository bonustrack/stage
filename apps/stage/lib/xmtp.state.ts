import type { Client } from '@xmtp/react-native-sdk';
import { createClientSlot, resetSharedXmtpState } from './xmtp.state.core';

export const clientSlot = createClientSlot<Client>(resetSharedXmtpState);

export const getCachedXmtpClient = clientSlot.get;
export const waitForXmtpReady = clientSlot.waitForReady;
