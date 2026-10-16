import { errorMessage } from '@stage-labs/client/errors';
import { createSmartAccount, resumeSmartAccount, restoreSmartAccount } from '../../lib/zerodev/create';
import { addPhrase } from '../../lib/zerodev/keyring';
import { AccountManager } from '../../modules/messaging/account';
import type { Hex } from 'viem';
import { addPrivateKeyAccount } from '../../lib/accounts';
import { applyProfileSetup } from '../../lib/profile';
import type { ProfileSetup } from './Onboarding.profile.model';
import { makeOnboarding } from '../../lib/onboarding.core';
import { readPendingSetup, writePendingSetup, clearPendingSetup } from '../../lib/onboardingPending';
import { preserveProfileImage } from '../../lib/onboardingImage';

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

const creation = makeOnboarding({
  read: readPendingSetup, write: writePendingSetup, clear: clearPendingSetup,
  preserveImage: preserveProfileImage, create: createSmartAccount, resume: resumeSmartAccount,
  messaging: (id) => bringMessagingOnline(id),
  profile: (account, profile, progress, checkpoint) => applyProfileSetup(account.address, profile, progress, checkpoint),
});

export async function createWallet(onStage?: (s: Stage) => void, profile?: ProfileSetup): Promise<SetupWarning> {
  await creation.run(profile, onStage);
  return null;
}

export const editableCreatedProfile = creation.editableProfile;
export const editCreatedProfile = creation.editProfile;

export async function resumeCreatedWallet(onStage?: (s: Stage) => void): Promise<SetupWarning> {
  await creation.resume(onStage);
  return null;
}

export async function restoreWallet(phrase: string, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const { record, alreadyImported } = await restoreSmartAccount(await addPhrase(phrase));
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
