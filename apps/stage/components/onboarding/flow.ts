import { errorMessage } from '@stage-labs/client/errors';
import { createSmartAccount, enablePasskeyForRecord, passkeysAvailable, restoreSmartAccount } from '../../lib/zerodev';
import { adoptPhrase } from '../../lib/accountTransfer';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount, type AccountRecord } from '../../lib/accounts';
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
  rec: AccountRecord, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<{ id: string; address: string; warning: SetupWarning }> {
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
  onStage?.('wallet');
  const account = await finishAccount(await createSmartAccount(), withPasskey, onStage);
  if (profile === undefined) return account.warning;
  return account.warning ?? await setUpProfile(account.address, profile, onStage);
}

export async function restoreWallet(
  phrase: string, withPasskey: boolean, onStage?: (s: Stage) => void,
): Promise<SetupWarning> {
  onStage?.('wallet');
  const { record, alreadyImported } = await restoreSmartAccount(await adoptPhrase(phrase));
  if (alreadyImported) {
    await bringMessagingOnline(record.id, onStage);
    return { title: 'Already on this device', message: 'This account was already imported here, so we switched to it instead of adding it again.' };
  }
  return (await finishAccount(record, withPasskey, onStage)).warning;
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
  return null;
}
