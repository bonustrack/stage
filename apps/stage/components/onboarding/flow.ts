import { errorMessage } from '@stage-labs/client/errors';
import { createSmartAccount, passkeysAvailable, restoreSmartAccount } from '../../lib/zerodev';
import { enableDevicePasskey } from '../../lib/zerodev/devicePasskeyFlow';
import { adoptPhrase } from '../../lib/accountTransfer';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount, loadAccounts, removeAccount, type AccountRecord } from '../../lib/accounts';
import { applyProfileSetup } from '../../lib/claimName';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Stage = 'wallet' | 'passkey' | 'messaging' | 'profile' | 'history' | 'finishing';

export type PasskeyChoice = 'none' | 'add';

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

export class PasskeySetupError extends Error {
  readonly accountId: string;
  constructor(accountId: string, message: string) {
    super(message);
    this.name = 'PasskeySetupError';
    this.accountId = accountId;
  }
}

export type SetupWarning = { title: string; message: string } | null;

const PASSKEY_FALLBACK = 'The passkey could not be set up on this device.';
const PASSKEY_CANCELLED = 'The passkey prompt was dismissed before it finished.';
const PROFILE_LATER = 'You can set your name and picture later from Settings, Profile.';

async function securePasskey(rec: AccountRecord, onStage?: (s: Stage) => void): Promise<void> {
  onStage?.('passkey');
  const res = await enableDevicePasskey(rec);
  if (res.ok) return;
  throw new PasskeySetupError(rec.id, res.cancelled === true ? PASSKEY_CANCELLED : res.message || PASSKEY_FALLBACK);
}

async function finishAccount(
  rec: AccountRecord, passkey: PasskeyChoice, onStage?: (s: Stage) => void,
): Promise<void> {
  if (passkey !== 'none' && passkeysAvailable()) await securePasskey(rec, onStage);
  await bringMessagingOnline(rec.id, onStage);
}

export async function resumeWithPasskey(accountId: string, onStage?: (s: Stage) => void): Promise<void> {
  const rec = (await loadAccounts()).find((a) => a.id === accountId);
  if (!rec) throw new Error('This account is no longer on the device.');
  await finishAccount(rec, 'add', onStage);
}

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

export async function createWallet(
  passkey: PasskeyChoice, onStage?: (s: Stage) => void, profile?: ProfileSetup,
): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await createSmartAccount();
  await finishAccount(rec, passkey, onStage);
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
