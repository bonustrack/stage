import { useEffect } from 'react';
import { ensureActiveAccount } from '../xmtp.recover.core';
import { getOrCreateXmtpClient } from '../xmtp.client';
import type { AccountGate } from '../accountGate';
import { reported } from '../errorPolicy';
import { useChannelsSync } from './channelsSync';
import { ensureMessagingStreamSync } from './streamSync';

export async function bootMessaging(openClient: boolean): Promise<void> {
  await ensureActiveAccount();
  if (openClient) await getOrCreateXmtpClient('production');
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
