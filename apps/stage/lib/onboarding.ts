import type { Hex } from 'viem';
import type { ProfileSetup } from '@stage-labs/client/profile/setup';
import { createSmartAccount, resumeSmartAccount, restoreSmartAccount } from './zerodev/create';
import { addPhrase } from './zerodev/keyring';
import { switchToAccount } from './xmtp.client';
import { addPrivateKeyAccount } from './accounts';
import { applyProfileSetup } from './profile';
import { XmtpSetupError, makeOnboarding } from './onboarding.core';
import { readPendingSetup, writePendingSetup, clearPendingSetup } from './onboardingPending';
import { preserveProfileImage } from './onboardingImage';

export type Stage = 'wallet' | 'messaging' | 'profile' | 'history' | 'finishing';

export async function bringMessagingOnline(accountId: string, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('messaging');
  try {
    await switchToAccount(accountId);
  } catch (e) {
    throw new XmtpSetupError(accountId, e);
  }
}

export type SetupWarning = { title: string; message: string } | null;

const creation = makeOnboarding({
  read: readPendingSetup,
  write: writePendingSetup,
  clear: clearPendingSetup,
  preserveImage: preserveProfileImage,
  create: createSmartAccount,
  resume: resumeSmartAccount,
  messaging: (id) => bringMessagingOnline(id),
  profile: (account, profile, progress, checkpoint) => applyProfileSetup(account.address, profile, progress, checkpoint),
});

export function createWallet(onStage?: (s: Stage) => void, profile?: ProfileSetup): Promise<void> {
  return creation.run(profile, onStage);
}

export const resumeCreatedWallet = creation.resume;

export const editableCreatedProfile = creation.editableProfile;

export const editCreatedProfile = creation.editProfile;

export async function restoreWallet(phrase: string, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const { record, alreadyImported } = await restoreSmartAccount(await addPhrase(phrase));
  await bringMessagingOnline(record.id, onStage);
  if (!alreadyImported) return null;
  return {
    title: 'Already on this device',
    message: 'This account was already imported here, so we switched to it instead of adding it again.',
  };
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
}
