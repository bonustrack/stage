
import {
  restoreMnemonic, createSmartAccount, enablePasskeyForRecord, passkeysAvailable,
} from '../../lib/zerodev';
import { AccountManager } from '../../modules/messaging';

export type Stage = 'wallet' | 'messaging' | 'finishing';

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
  onStage?.('finishing');
  AccountManager.bumpEpoch();
}

async function finishAccount(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('wallet');
  const rec = await createSmartAccount();
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!res.ok && res.reason !== 'already') {
      throw new Error(res.message ?? 'Could not set up the passkey for this account.');
    }
  }
  await bringMessagingOnline(rec.id, onStage);
}

export async function createWallet(withPasskey: boolean, onStage?: (s: Stage) => void): Promise<void> {
  await finishAccount(withPasskey, onStage);
}

export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<void> {
  onStage?.('wallet');
  await restoreMnemonic(phrase);
  await finishAccount(withPasskey, onStage);
}
