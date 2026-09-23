import { errorMessage } from '@stage-labs/client/errors';
import {
  createSmartAccount, enablePasskeyForRecord, passkeysAvailable, peekRestorableAccount, restoreSmartAccount,
} from '../../lib/zerodev';
import { kernelCustody } from '../../lib/zerodev/linkPasskey';
import { adoptPhrase } from '../../lib/accountTransfer';
import { AccountManager } from '../../modules/messaging';
import type { Hex } from 'viem';
import { addPrivateKeyAccount, loadAccounts, removeAccount, type AccountRecord } from '../../lib/accounts';
import { applyProfileSetup } from '../../lib/claimName';
import type { ProfileSetup } from './Onboarding.profile.model';

export type Stage = 'wallet' | 'passkey' | 'messaging' | 'profile' | 'history' | 'finishing';

export type PasskeyChoice = 'none' | 'add' | 'verify';

export type PasskeyMode = Exclude<PasskeyChoice, 'none'>;

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
  const res = await enablePasskeyForRecord(rec);
  if (res.ok || res.reason === 'already') return;
  throw new PasskeySetupError(rec.id, res.reason === 'cancelled' ? PASSKEY_CANCELLED : res.message ?? PASSKEY_FALLBACK);
}

const PASSKEY_REQUIRED = 'This wallet is secured by a passkey. Confirm that passkey on this device to continue.';

async function passkeyRequired(rec: AccountRecord): Promise<boolean> {
  return (await kernelCustody(rec.address as `0x${string}`)) === 'passkey-root';
}

export interface PhraseInspection { passkeyRequired: boolean; alreadyImported: boolean }

export async function inspectPhrase(phrase: string): Promise<PhraseInspection> {
  const { address, alreadyImported } = await peekRestorableAccount(await adoptPhrase(phrase));
  if (alreadyImported) return { passkeyRequired: false, alreadyImported };
  return { passkeyRequired: (await kernelCustody(address)) === 'passkey-root', alreadyImported };
}

async function finishAccount(
  rec: AccountRecord, passkey: PasskeyChoice, onStage?: (s: Stage) => void,
): Promise<void> {
  const withPasskey = passkey !== 'none';
  const required = !withPasskey && await passkeyRequired(rec);
  if (required && !passkeysAvailable()) throw new PasskeySetupError(rec.id, PASSKEY_REQUIRED);
  if ((withPasskey || required) && passkeysAvailable()) await securePasskey(rec, onStage);
  await bringMessagingOnline(rec.id, onStage);
}

export async function confirmRestoredPasskey(phrase: string): Promise<string> {
  const { record } = await restoreSmartAccount(await adoptPhrase(phrase));
  await securePasskey(record);
  return record.id;
}

export async function resumeWithPasskey(accountId: string, onStage?: (s: Stage) => void): Promise<void> {
  const rec = (await loadAccounts()).find((a) => a.id === accountId);
  if (!rec) throw new Error('This account is no longer on the device.');
  await finishAccount(rec, 'verify', onStage);
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

export async function restoreWallet(
  phrase: string, passkey: PasskeyChoice, onStage?: (s: Stage) => void,
): Promise<SetupWarning> {
  onStage?.('wallet');
  const { record, alreadyImported } = await restoreSmartAccount(await adoptPhrase(phrase));
  if (alreadyImported) {
    await bringMessagingOnline(record.id, onStage);
    return { title: 'Already on this device', message: 'This account was already imported here, so we switched to it instead of adding it again.' };
  }
  await finishAccount(record, passkey, onStage);
  return null;
}

export async function importKeyAccount(pk: Hex, onStage?: (s: Stage) => void): Promise<SetupWarning> {
  onStage?.('wallet');
  const rec = await addPrivateKeyAccount(pk);
  await bringMessagingOnline(rec.id, onStage);
  return null;
}
