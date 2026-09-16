
import '../cryptoShim';
import { secureStorage } from '../../platform/storage';
import { migrateLegacyHdIndex, resetSmartHdIndex } from './hdIndexStore';
import type { DeviceBoundAccessOptions } from '../../platform/types';
import {
  privateKeyToAccount,
  type PrivateKeyAccount, type HDAccount,
} from 'viem/accounts';
import { keccak256, stringToBytes, type Hex } from 'viem';
import {
  generateWalletMnemonic, normalizeMnemonic, isValidMnemonic, deriveOwner,
} from '@stage-labs/client/zerodev/derive';
import {
  PK_PREFIX, LEGACY_PK_KEY,
} from '@stage-labs/client/accounts/keys';


const STORE_OPTS: DeviceBoundAccessOptions = {
  thisDeviceOnly: true,
};

const AUTH_SENTINEL_KEY = 'wallet.authGate';

const SENTINEL_OPTS: DeviceBoundAccessOptions = {
  requireAuthentication: true,
  thisDeviceOnly: true,
  authenticationPrompt: 'Verify it is you to reveal this secret',
};

async function requireDeviceAuth(): Promise<boolean> {
  const existing = await secureStorage.get(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => 'DENIED');
  if (existing === 'DENIED') return false;
  if (existing !== null) return true;
  try {
    await secureStorage.set(AUTH_SENTINEL_KEY, '1', SENTINEL_OPTS);
  } catch {
    return true;
  }
  return (await secureStorage.get(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => null)) !== null;
}

async function requireRevealAuth(id?: string): Promise<boolean> {
  let stored: import('./passkeys.model').StoredPasskey | undefined;
  try {
    const { getActiveAccount, loadAccounts } = await import('../accounts');
    const rec = id
      ? (await loadAccounts()).find((a) => a.id === id.toLowerCase())
      : await getActiveAccount();
    stored = rec?.passkey;
  } catch {
    stored = undefined;
  }
  if (stored) {
    const { assertPasskeyPresence } = await import('./passkeys');
    const ok = await assertPasskeyPresence(stored);
    if (ok !== null) return ok;
  }
  return requireDeviceAuth();
}


const PHRASE_KEY_PREFIX = 'wallet.mnemonic.';
const PRIMARY_PHRASE_KEY = 'wallet.mnemonic.primary';
const LEGACY_MNEMONIC_KEY = 'wallet.mnemonic';

export interface SmartKeyRef { hdIndex: number; phraseId?: string }

export function phraseIdOf(phrase: string): string {
  return keccak256(stringToBytes(normalizeMnemonic(phrase))).slice(2, 18);
}

const phraseKey = (phraseId: string): string => `${PHRASE_KEY_PREFIX}${phraseId}`;
const sessionPhrases = new Map<string, string>();
const ownerCache = new Map<string, HDAccount>();

async function storePhrase(phraseId: string, phrase: string): Promise<void> {
  await secureStorage.set(phraseKey(phraseId), phrase, STORE_OPTS);
  sessionPhrases.set(phraseId, phrase);
}

async function migrateLegacyPhrase(): Promise<void> {
  const raw = await secureStorage.get(LEGACY_MNEMONIC_KEY, STORE_OPTS).catch(() => null);
  if (!raw) return;
  const phrase = normalizeMnemonic(raw);
  if (isValidMnemonic(phrase)) {
    const id = phraseIdOf(phrase);
    await storePhrase(id, phrase);
    await secureStorage.set(PRIMARY_PHRASE_KEY, id, STORE_OPTS);
    await migrateLegacyHdIndex(id);
  }
  await secureStorage.delete(LEGACY_MNEMONIC_KEY).catch(() => undefined);
}

let migration: Promise<void> | null = null;
const migrated = (): Promise<void> => { migration ??= migrateLegacyPhrase(); return migration; };

export async function primaryPhraseId(): Promise<string | null> {
  await migrated();
  return secureStorage.get(PRIMARY_PHRASE_KEY, STORE_OPTS).catch(() => null);
}

async function phraseIdFor(ref: { phraseId?: string }): Promise<string> {
  const id = ref.phraseId ?? await primaryPhraseId();
  if (!id) throw new Error('Recovery phrase unavailable for this smart account.');
  return id;
}

async function readPhrase(phraseId: string): Promise<string | null> {
  await migrated();
  const cached = sessionPhrases.get(phraseId);
  if (cached) return cached;
  const raw = await secureStorage.get(phraseKey(phraseId), STORE_OPTS).catch(() => null);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  if (!isValidMnemonic(phrase)) return null;
  sessionPhrases.set(phraseId, phrase);
  return phrase;
}

export async function addPhrase(phrase: string): Promise<string> {
  const norm = normalizeMnemonic(phrase);
  if (!isValidMnemonic(norm)) throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  const id = phraseIdOf(norm);
  if ((await readPhrase(id)) === null) await storePhrase(id, norm);
  if ((await primaryPhraseId()) === null) await secureStorage.set(PRIMARY_PHRASE_KEY, id, STORE_OPTS);
  return id;
}

export async function ensurePrimaryPhrase(): Promise<string> {
  const existing = await primaryPhraseId();
  if (existing && (await readPhrase(existing)) !== null) return existing;
  return addPhrase(generateWalletMnemonic());
}

export async function deletePhrase(phraseId: string, nextPrimary: string | null): Promise<void> {
  sessionPhrases.delete(phraseId);
  for (const key of [...ownerCache.keys()]) if (key.startsWith(`${phraseId}:`)) ownerCache.delete(key);
  await resetSmartHdIndex(phraseId);
  await secureStorage.delete(phraseKey(phraseId)).catch(() => undefined);
  if ((await primaryPhraseId()) !== phraseId) return;
  if (nextPrimary) await secureStorage.set(PRIMARY_PHRASE_KEY, nextPrimary, STORE_OPTS);
  else await secureStorage.delete(PRIMARY_PHRASE_KEY).catch(() => undefined);
}

async function ownerFor(ref: SmartKeyRef): Promise<HDAccount> {
  const phraseId = await phraseIdFor(ref);
  const key = `${phraseId}:${ref.hdIndex}`;
  const cached = ownerCache.get(key);
  if (cached) return cached;
  const phrase = await readPhrase(phraseId);
  if (!phrase) throw new Error('Recovery phrase unavailable for this smart account.');
  const owner = deriveOwner(phrase, ref.hdIndex);
  ownerCache.set(key, owner);
  return owner;
}

export async function smartOwnerAddress(ref: SmartKeyRef): Promise<string> {
  return (await ownerFor(ref)).address.toLowerCase();
}

export async function smartOwnerSigner(ref: SmartKeyRef): Promise<HDAccount> {
  return ownerFor(ref);
}

export async function signOwnerMessage(ref: SmartKeyRef, message: string): Promise<Hex> {
  const owner = await ownerFor(ref);
  return owner.signMessage({ message });
}

async function loadPrivateKey(id: string): Promise<Hex | null> {
  const pk = await secureStorage.get(PK_PREFIX + id, STORE_OPTS).catch(() => null);
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  const legacy = await secureStorage.get(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await secureStorage.set(PK_PREFIX + id, norm, STORE_OPTS).catch(() => undefined);
        return norm;
      }
    } catch { }
  }
  return null;
}

async function storePrivateKey(id: string, pk: Hex): Promise<void> {
  await secureStorage.set(PK_PREFIX + id, pk, STORE_OPTS);
}

export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await loadPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

export async function importPrivateKey(pk: Hex): Promise<{ id: string; address: string }> {
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

export async function adoptLegacyKey(): Promise<{ id: string; address: string } | null> {
  const legacy = await secureStorage.get(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (!legacy || !/^0x[0-9a-fA-F]{64}$/.test(legacy)) return null;
  const pk = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

export async function deleteKey(id: string): Promise<void> {
  await secureStorage.delete(PK_PREFIX + id).catch(() => undefined);
}


export async function revealRecoveryPhrase(ref: { phraseId?: string } = {}): Promise<string | null> {
  if (!(await requireRevealAuth())) return null;
  return readPhrase(await phraseIdFor(ref));
}

export async function revealPrivateKey(id: string): Promise<Hex | null> {
  if (!(await requireRevealAuth(id))) return null;
  return loadPrivateKey(id);
}
