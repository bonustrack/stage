
import {
  restoreMnemonic, createSmartAccount, enablePasskeyForRecord, passkeysAvailable,
} from '../../lib/zerodev';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount } from '../../lib/accounts';

export type Stage = 'wallet' | 'messaging' | 'history' | 'finishing';

export class XmtpSetupError extends Error {
  readonly accountId: string;
  constructor(accountId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'XmtpSetupError';
    this.accountId = accountId;
  }
}

export async function bringMessagingOnline(
  accountId: string, onStage?: (s: Stage) => void,
): Promise<void> {
  onStage?.('messaging');
  try {
    await AccountManager.switch(accountId);
  } catch (e) {
    throw new XmtpSetupError(accountId, e);
  }
  AccountManager.bumpEpoch();
}

export type SetupWarning = string | null;

const PASSKEY_FALLBACK = 'The passkey could not be set up for this account on this device.';

async function finishAccount(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await createSmartAccount();
  let warning: SetupWarning = null;
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!(res.ok || res.reason === 'already' || res.reason === 'cancelled')) {
      warning = res.message ?? PASSKEY_FALLBACK;
    }
  }
  await bringMessagingOnline(rec.id, onStage);
  return warning;
}

export async function createWallet(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  return finishAccount(withPasskey, onStage);
}

export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<SetupWarning> {
  onStage?.('wallet');
  await restoreMnemonic(phrase);
  return finishAccount(withPasskey, onStage);
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
  return null;
}
