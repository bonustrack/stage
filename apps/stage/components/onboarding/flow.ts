import { errorMessage } from '@stage-labs/client/errors';
import { createSmartAccount, enablePasskeyForRecord, passkeysAvailable } from '../../lib/zerodev';
import { adoptPhrase } from '../../lib/accountTransfer';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount } from '../../lib/accounts';
import { applyProfileSetup } from '../../lib/profileSetup';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Stage = 'wallet' | 'messaging' | 'profile' | 'history' | 'finishing';

export class XmtpSetupError extends Error {
  readonly accountId: string;
  constructor(accountId: string, cause: unknown) {
    super(errorMessage(cause));
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

export type SetupWarning = { title: string; message: string } | null;

const PASSKEY_FALLBACK = 'The passkey could not be set up for this account on this device.';
const PASSKEY_LATER = 'You can add a passkey later from Settings, Security.';
const PROFILE_LATER = 'You can set your name and picture later from Settings, Profile.';

async function finishAccount(
  withPasskey: boolean, fresh: boolean, onStage?: (s: Stage) => void, phraseId?: string,
): Promise<{ id: string; address: string; warning: SetupWarning }> {
  onStage?.('wallet');
  const rec = await createSmartAccount({ fresh, phraseId });
  let warning: SetupWarning = null;
  if (withPasskey && passkeysAvailable()) {
    const res = await enablePasskeyForRecord(rec);
    if (!(res.ok || res.reason === 'already' || res.reason === 'cancelled')) {
      warning = { title: 'Passkey not added', message: `${res.message ?? PASSKEY_FALLBACK} ${PASSKEY_LATER}` };
    }
  }
  await bringMessagingOnline(rec.id, onStage);
  return { id: rec.id, address: rec.address, warning };
}

async function setUpProfile(address: string, profile: ProfileSetup, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('profile');
  try {
    await applyProfileSetup(address, profile);
    return null;
  } catch (e) {
    return { title: 'Profile not saved', message: `${errorMessage(e)} ${PROFILE_LATER}` };
  }
}

export async function createWallet(
  withPasskey: boolean, onStage?: (s: Stage) => void, profile?: ProfileSetup,
): Promise<SetupWarning> {
  const account = await finishAccount(withPasskey, true, onStage);
  if (profile === undefined) return account.warning;
  return account.warning ?? await setUpProfile(account.address, profile, onStage);
}

export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<SetupWarning> {
  onStage?.('wallet');
  const phraseId = await adoptPhrase(phrase);
  return (await finishAccount(withPasskey, false, onStage, phraseId)).warning;
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
  return null;
}
