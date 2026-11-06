import type { Hex } from 'viem';
import { baseProfileClient, resolveBasenameProfile } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedName, stageLabelOf } from '@stage-labs/client/identity/stageNames';
import { registerMailKey } from '@stage-labs/client/mail/api';
import { deriveMailKey, isMailboxLabel, mailPublicKeyHex } from '@stage-labs/client/mail/mailbox';
import type { AccountRecord } from './accounts';
import { linkProxyBase } from './linkProxy';
import { signingKeyForRecord } from './xmtp.signing.core';

export async function claimMailKey(rec: AccountRecord, label: string): Promise<Hex | undefined> {
  if (!isMailboxLabel(label)) return undefined;
  const { signMessage } = await signingKeyForRecord(rec);
  return mailPublicKeyHex(await deriveMailKey(label, signMessage));
}

export async function registerOwnMailKey(rec: AccountRecord, label: string): Promise<void> {
  const { signMessage } = await signingKeyForRecord(rec);
  await registerMailKey(linkProxyBase(), label, await deriveMailKey(label, signMessage), signMessage);
}

export async function ownedStageLabel(address: string): Promise<string | null> {
  const issued = await fetchIssuedName(linkProxyBase(), address);
  if (issued !== null) return stageLabelOf(issued);
  return stageLabelOf((await resolveBasenameProfile(baseProfileClient(), address))?.name);
}
