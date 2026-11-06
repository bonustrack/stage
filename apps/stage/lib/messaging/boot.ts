import { useEffect } from 'react';
import { getActiveAccount } from '../accounts';
import { xmtpClient } from '../xmtp.client';
import type { AccountGate } from '../accountGate';
import { reported } from '../errorPolicy';
import { useChannelsSync } from './channelsSync';
import { ensureMessagingStreamSync } from './streamSync';

export async function bootMessaging(openClient: boolean): Promise<void> {
  await getActiveAccount();
  if (openClient) await xmtpClient();
}

export function useMessagingBoot(gate: AccountGate, openClient: boolean): void {
  useChannelsSync(!gate.ready || gate.hasAccount);
  useEffect(() => {
    if (!gate.hasAccount) return;
    void bootMessaging(openClient).catch(reported('boot.client'));
  }, [gate.hasAccount]);
  useEffect(() => {
    ensureMessagingStreamSync();
  }, []);
}
