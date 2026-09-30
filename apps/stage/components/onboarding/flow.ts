import { errorMessage } from '@stage-labs/client/errors';
import { createSmartAccount, restoreSmartAccount } from '../../lib/zerodev';
import { adoptPhrase } from '../../lib/accountTransfer';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount, removeAccount } from '../../lib/accounts';
import { applyProfileSetup } from '../../lib/claimName';
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
}

export type SetupWarning = { title: string; message: string } | null;

const PROFILE_LATER = 'You can set your name and picture later from Settings, Profile.';

export async function abandonAccount(accountId: string): Promise<void> {
  await removeAccount(accountId);
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

export async function createWallet(onStage?: (s: Stage) => void, profile?: ProfileSetup): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await createSmartAccount();
  await bringMessagingOnline(rec.id, onStage);
  if (profile === undefined) return null;
  return setUpProfile(rec.address, profile, onStage);
}

export async function restoreWallet(phrase: string, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const { record, alreadyImported } = await restoreSmartAccount(await adoptPhrase(phrase));
  await bringMessagingOnline(record.id, onStage);
  if (!alreadyImported) return null;
  return { title: 'Already on this device', message: 'This account was already imported here, so we switched to it instead of adding it again.' };
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
  return null;
}
