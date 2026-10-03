import { useEffect } from 'react';
import type { Hex } from 'viem';
import { baseProfileClient, resolveBasenameProfile } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedName } from '@stage-labs/client/identity/stageNames';
import { ensureMailKey, registerMailKey } from '@stage-labs/client/mail/api';
import { deriveMailKey, isMailboxLabel, mailPublicKeyHex } from '@stage-labs/client/mail/mailbox';
import { stageLabelOf } from '@stage-labs/client/routing/handles';
import { getActiveAccount, type AccountRecord } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { linkProxyBase } from './historyServer';
import { reported } from './errorPolicy';
import { lazySigningKeyForRecord, signingKeyForRecord } from './xmtp.signing.core';

const checked = new Set<string>();

export async function claimMailKey(rec: AccountRecord, label: string): Promise<Hex | undefined> {
  if (!isMailboxLabel(label)) return undefined;
  const { signMessage } = await signingKeyForRecord(rec);
  return mailPublicKeyHex(await deriveMailKey(label, signMessage));
}

export async function registerOwnMailKey(rec: AccountRecord, label: string): Promise<void> {
  const { signMessage } = await signingKeyForRecord(rec);
  await registerMailKey(linkProxyBase(), label, await deriveMailKey(label, signMessage), signMessage);
}

async function ownedStageLabel(address: string): Promise<string | null> {
  const issued = await fetchIssuedName(linkProxyBase(), address);
  if (issued !== null) return stageLabelOf(issued);
  return stageLabelOf((await resolveBasenameProfile(baseProfileClient(), address))?.name);
}

async function syncActiveMailKey(): Promise<void> {
  const rec = await getActiveAccount();
  if (rec === null || checked.has(rec.address)) return;
  const label = await ownedStageLabel(rec.address);
  if (label !== null && isMailboxLabel(label)) {
    const { signMessage } = await lazySigningKeyForRecord(rec);
    await ensureMailKey(linkProxyBase(), label, rec.address, signMessage);
  }
  checked.add(rec.address);
}

export function useOwnMailKey(enabled: boolean): void {
  const epoch = useAccountEpoch();
  useEffect(() => {
    if (enabled) void syncActiveMailKey().catch(reported('mail.key'));
  }, [enabled, epoch]);
}
