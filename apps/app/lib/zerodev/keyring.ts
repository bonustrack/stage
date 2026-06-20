
import '../cryptoShim';
import * as SecureStore from 'expo-secure-store';
import {
  privateKeyToAccount,
  type PrivateKeyAccount, type HDAccount,
} from 'viem/accounts';
import { type Hex } from 'viem';
import {
  generateWalletMnemonic, normalizeMnemonic, isValidMnemonic, deriveOwner,
} from '@stage-labs/client/zerodev/derive';
import {
  PK_PREFIX, LEGACY_PK_KEY,
} from '@stage-labs/client/accounts/keys';


const MNEMONIC_KEY = 'wallet.mnemonic';

const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const AUTH_SENTINEL_KEY = 'wallet.authGate';

const SENTINEL_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Verify it is you to reveal this secret',
};

async function requireDeviceAuth(): Promise<boolean> {
  const existing = await SecureStore.getItemAsync(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => 'DENIED');
  if (existing === 'DENIED') return false;
  if (existing !== null) return true;
  try {
    await SecureStore.setItemAsync(AUTH_SENTINEL_KEY, '1', SENTINEL_OPTS);
  } catch {
    return true;
  }
  return (await SecureStore.getItemAsync(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => null)) !== null;
}

async function requireRevealAuth(id?: string): Promise<boolean> {
  let stored: import('./account').StoredPasskey | undefined;
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
    const { assertPasskeyPresence } = await import('./account');
    const ok = await assertPasskeyPresence(stored);
    if (ok !== null) return ok;
  }
  return requireDeviceAuth();
}


let sessionMnemonic: string | null = null;

async function readMnemonic(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(MNEMONIC_KEY, STORE_OPTS).catch(() => null);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  return isValidMnemonic(phrase) ? phrase : null;
}

async function unlockMnemonic(): Promise<string | null> {
  if (sessionMnemonic) return sessionMnemonic;
  const phrase = await readMnemonic();
  if (phrase) sessionMnemonic = phrase;
  return phrase;
}

export async function restoreMnemonic(phrase: string): Promise<void> {
  const norm = normalizeMnemonic(phrase);
  if (!isValidMnemonic(norm)) throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  await SecureStore.setItemAsync(MNEMONIC_KEY, norm, STORE_OPTS);
  sessionMnemonic = norm;
  ownerCache.clear();
}

export async function clearMnemonic(): Promise<void> {
  sessionMnemonic = null;
  ownerCache.clear();
  await SecureStore.deleteItemAsync(MNEMONIC_KEY).catch(() => undefined);
}

export async function ensureMnemonic(): Promise<void> {
  const existing = await unlockMnemonic();
  if (existing) return;
  const minted = generateWalletMnemonic();
  await SecureStore.setItemAsync(MNEMONIC_KEY, minted, STORE_OPTS);
  sessionMnemonic = minted;
  ownerCache.clear();
}


const ownerCache = new Map<number, HDAccount>();

async function ownerFor(hdIndex: number): Promise<HDAccount> {
  const cached = ownerCache.get(hdIndex);
  if (cached) return cached;
  const mnemonic = await unlockMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable for this smart account.');
  const owner = deriveOwner(mnemonic, hdIndex);
  ownerCache.set(hdIndex, owner);
  return owner;
}

export async function smartOwnerAddress(hdIndex: number): Promise<string> {
  return (await ownerFor(hdIndex)).address.toLowerCase();
}

export async function smartOwnerSigner(hdIndex: number): Promise<HDAccount> {
  return ownerFor(hdIndex);
}

export async function signOwnerMessage(hdIndex: number, message: string): Promise<Hex> {
  const owner = await ownerFor(hdIndex);
  return owner.signMessage({ message });
}


async function loadPrivateKey(id: string): Promise<Hex | null> {
  const pk = await SecureStore.getItemAsync(PK_PREFIX + id, STORE_OPTS).catch(() => null);
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await SecureStore.setItemAsync(PK_PREFIX + id, norm, STORE_OPTS).catch(() => undefined);
        return norm;
      }
    } catch { }
  }
  return null;
}

async function storePrivateKey(id: string, pk: Hex): Promise<void> {
  await SecureStore.setItemAsync(PK_PREFIX + id, pk, STORE_OPTS);
}

export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await loadPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

export async function adoptLegacyKey(): Promise<{ id: string; address: string } | null> {
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (!legacy || !/^0x[0-9a-fA-F]{64}$/.test(legacy)) return null;
  const pk = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

export async function deleteKey(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(PK_PREFIX + id).catch(() => undefined);
}

export async function clearLegacyKey(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_PK_KEY).catch(() => undefined);
}


export interface RailgunKeyMaterial {
  mnemonic: string;
  encryptionKey: string;
}

export async function railgunKeyMaterialFor(id: string): Promise<RailgunKeyMaterial | null> {
  const pk = await loadPrivateKey(id);
  if (!pk) return null;
  const { mnemonicFromPrivateKey, encryptionKeyFromPrivateKey } = await import('../railgun/deriveKeys');
  return {
    mnemonic: mnemonicFromPrivateKey(pk),
    encryptionKey: encryptionKeyFromPrivateKey(pk),
  };
}


export async function revealRecoveryPhrase(): Promise<string | null> {
  if (!(await requireRevealAuth())) return null;
  return readMnemonic();
}

export async function revealPrivateKey(id: string): Promise<Hex | null> {
  if (!(await requireRevealAuth(id))) return null;
  return loadPrivateKey(id);
}
