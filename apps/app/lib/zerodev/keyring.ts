/**
 * @file The keyring: the one and only chokepoint for private-key + mnemonic access. Signs in place behind a single-module lockdown (ESLint + test invariant) so secrets stay OS-keystore-encrypted at rest, everyday use never prompts, and only the two passkey/device-auth-guarded reveals (recovery phrase / private key) ever return material.
 */

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

// ===========================================================================
// Storage-key constants (PRIVATE — never exported; no other file names them).
// ===========================================================================

/** SecureStore key for the single app BIP-39 mnemonic. `[A-Za-z0-9._-]+` only (colons are rejected on Android). */
const MNEMONIC_KEY = 'wallet.mnemonic';

/**
 * Storage options for ALL secret material (mnemonic + per-account PKs). Encrypted
 *  at rest + device-bound (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) but NOT
 *  `requireAuthentication`, so a normal read/sign NEVER prompts. The only
 *  device-auth is the explicit reveal gate (see note 4).
 */
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** SecureStore key for the device-auth GATE SENTINEL (the no-passkey reveal gate). Holds no secret — `requireAuthentication: true` so reading it forces the OS biometric/passcode sheet. JS-only (no expo-local-authentication, not in build). */
const AUTH_SENTINEL_KEY = 'wallet.authGate';

/** Hardened sentinel options: `requireAuthentication` prompts on every read. */
const SENTINEL_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Verify it is you to reveal this secret',
};

/**
 * Device-auth gate (the no-passkey reveal path). Forces the OS biometric/passcode
 *  sheet by reading a hardened sentinel (provisioned lazily). true on success,
 *  false if declined/fails. A no-secure-lock device throws on the hardened write
 *  -> allow (secret is already on-device, UI warns) rather than lock the user out.
 */
async function requireDeviceAuth(): Promise<boolean> {
  // Reading a hardened item prompts; a missing item returns null with NO prompt;
  // a cancelled/failed prompt throws (mapped to 'DENIED').
  const existing = await SecureStore.getItemAsync(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => 'DENIED');
  if (existing === 'DENIED') return false;
  if (existing !== null) return true; // hardened read succeeded => auth passed.
  // No sentinel yet: provision it hardened (a no-lock device throws => allow),
  // then read back to force the prompt for this reveal too.
  try {
    await SecureStore.setItemAsync(AUTH_SENTINEL_KEY, '1', SENTINEL_OPTS);
  } catch {
    return true;
  }
  return (await SecureStore.getItemAsync(AUTH_SENTINEL_KEY, SENTINEL_OPTS).catch(() => null)) !== null;
}

/**
 * REVEAL GATE (Less's finalized model: the passkey is the auth when set). Picks
 *  the gate for the two secret EXPORTS by the target account's stored passkey:
 *    - HAS a passkey + WebAuthn runs here -> a fresh on-device PASSKEY ASSERTION
 *      (`assertPasskeyPresence`) must succeed; cancel/fail returns false -> abort.
 *    - NO passkey, OR native module absent (assertPasskeyPresence -> null) -> fall
 *      back to the device-auth sentinel (`requireDeviceAuth`), so old binaries +
 *      phrase-only accounts still gate the raw seed.
 *  Stays INSIDE the chokepoint (secret read only on true). `id` scopes the lookup
 *  to the exported account (omit -> active, for the phrase). LAZY import avoids the
 *  static cycle (lib/accounts imports this module); a failed lookup -> device auth.
 */
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
    // true/false -> the passkey is the gate (honor cancel). null -> native module
    // absent on this binary; fall through to the device-auth sentinel.
    if (ok !== null) return ok;
  }
  return requireDeviceAuth();
}

// ===========================================================================
// Mnemonic provisioning (smart-account root).
// ===========================================================================

/**
 * SESSION CACHE (see SECURITY note 6). The decrypted, validated mnemonic for
 *  the current process. Populated by `unlockMnemonic()` (or on generate/restore,
 *  which already hold the plaintext), then reused by every derivation/sign to
 *  avoid redundant keystore round-trips. NO auth power — the reads it replaces
 *  also never prompt. Cleared on reset/nuke (`clearMnemonic`) and `lockSession()`.
 */
let sessionMnemonic: string | null = null;

/** Raw keystore read of the mnemonic. Encrypted at rest, but NO device-auth prompt (see STORE_OPTS). PRIVATE — `unlockMnemonic` and the reveal paths (which add their own explicit auth gate) call it. */
async function readMnemonic(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(MNEMONIC_KEY, STORE_OPTS).catch(() => null);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  return isValidMnemonic(phrase) ? phrase : null;
}

/**
 * Get the mnemonic for in-session use with NO device-auth prompt. Reads the
 *  keystore once (encrypted-at-rest, no prompt) and caches it in memory; later
 *  calls reuse the cache. Returns null when none is stored. PRIVATE — callers use
 *  the signer factories; only the two reveals expose the string.
 */
async function unlockMnemonic(): Promise<string | null> {
  if (sessionMnemonic) return sessionMnemonic;
  const phrase = await readMnemonic();
  if (phrase) sessionMnemonic = phrase;
  return phrase;
}

/** RESTORE: validate + store a user-supplied phrase. Throws on a phrase that fails BIP-39. Overwrites any existing value — guard call sites. */
export async function restoreMnemonic(phrase: string): Promise<void> {
  const norm = normalizeMnemonic(phrase);
  if (!isValidMnemonic(norm)) throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  await SecureStore.setItemAsync(MNEMONIC_KEY, norm, STORE_OPTS);
  // Seed the cache with the plaintext we just stored (restore flow derivation).
  sessionMnemonic = norm;
  ownerCache.clear();
}

/** Delete the stored mnemonic (dev reset / full nuke). Not hardened — a delete reads nothing, so it doesn't prompt. Best-effort. */
export async function clearMnemonic(): Promise<void> {
  sessionMnemonic = null;
  ownerCache.clear();
  await SecureStore.deleteItemAsync(MNEMONIC_KEY).catch(() => undefined);
}

/** GENERATE-ON-FIRST-USE: idempotently ensure a mnemonic exists, minting one on first call. Secret stays inside the module; no prompt. Call lazily, not on boot. */
export async function ensureMnemonic(): Promise<void> {
  const existing = await unlockMnemonic();
  if (existing) return;
  // None stored: mint one + seed the cache so the create flow runs prompt-free.
  const minted = generateWalletMnemonic();
  await SecureStore.setItemAsync(MNEMONIC_KEY, minted, STORE_OPTS);
  sessionMnemonic = minted;
  ownerCache.clear();
}

// ===========================================================================
// Smart-account (HD) signers — sign-in-place, owner derived from the mnemonic.
// ===========================================================================

/**
 * In-memory cache of derived owner HDAccounts, keyed by HD index. XMTP
 *  `Client.create` signs the owner identity SEVERAL times per flow; caching the
 *  derived HDAccount avoids re-deriving each sign and keeps create fast. Only the
 *  opaque viem signer object is cached, never a raw key/mnemonic string. Cleared
 *  on `clearMnemonic()` so a wiped wallet leaves nothing derivable in memory.
 */
const ownerCache = new Map<number, HDAccount>();

/**
 * Internal: derive the owner signer for a smart-account HD index. Reads the
 *  mnemonic (no prompt) then caches the opaque HDAccount in memory (see
 *  ownerCache) so repeat signs in one session don't re-derive. Throws if none
 *  stored. The returned HDAccount signs but exposes no key.
 */
async function ownerFor(hdIndex: number): Promise<HDAccount> {
  const cached = ownerCache.get(hdIndex);
  if (cached) return cached;
  const mnemonic = await unlockMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable for this smart account.');
  const owner = deriveOwner(mnemonic, hdIndex);
  ownerCache.set(hdIndex, owner);
  return owner;
}

/** The owner ADDRESS for an HD index (public, no auth — derives a throwaway view account is not possible without the phrase, so this DOES read; prefer the cached `ownerAddress` on the account record for view paths). */
export async function smartOwnerAddress(hdIndex: number): Promise<string> {
  return (await ownerFor(hdIndex)).address.toLowerCase();
}

/** The owner signer (viem HDAccount) for a smart-account index, used as the ZeroDev ECDSA validator `signer` and for guardian-recovery signing. Opaque signer — never the key. Reads the mnemonic (no prompt). */
export async function smartOwnerSigner(hdIndex: number): Promise<HDAccount> {
  return ownerFor(hdIndex);
}

/** An XMTP-style EOA signMessage for the smart account's owner identity (the legacy scwXmtp===false path). Signs in place; returns the hex signature. */
export async function signOwnerMessage(hdIndex: number, message: string): Promise<Hex> {
  const owner = await ownerFor(hdIndex);
  return owner.signMessage({ message });
}

// ===========================================================================
// Per-account EOA private keys (generated / imported wallets).
// ===========================================================================

/** Internal: load the raw private key for an account id, self-healing a legacy single-key location into the per-account slot. PRIVATE — the raw key never leaves except via revealPrivateKey / the in-place signers below. */
async function loadPrivateKey(id: string): Promise<Hex | null> {
  const pk = await SecureStore.getItemAsync(PK_PREFIX + id, STORE_OPTS).catch(() => null);
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  // Self-heal: a pre-multi-account key may live only under the legacy slot. Accept iff
  // it derives to THIS id, then re-write per-account (device-bound STORE_OPTS) so future reads are direct.
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await SecureStore.setItemAsync(PK_PREFIX + id, norm, STORE_OPTS).catch(() => undefined);
        return norm;
      }
    } catch { /* malformed legacy key — fall through to null */ }
  }
  return null;
}

/** Internal: store a private key under its per-account slot. Encrypted at rest, no device-auth gate (see STORE_OPTS) — reads for signing never prompt. */
async function storePrivateKey(id: string, pk: Hex): Promise<void> {
  await SecureStore.setItemAsync(PK_PREFIX + id, pk, STORE_OPTS);
}

/** A viem signer for an account id, or null when no key is stored (WalletConnect / smart). Opaque signer — signs in place, never exposes the key. */
export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await loadPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

/** Migrate a legacy single `wallet.privateKey` into the per-account slot, used by the registry's first-run migration. Returns the migrated (id, address) or null when there is no valid legacy key. */
export async function adoptLegacyKey(): Promise<{ id: string; address: string } | null> {
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY, STORE_OPTS).catch(() => null);
  if (!legacy || !/^0x[0-9a-fA-F]{64}$/.test(legacy)) return null;
  const pk = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

/** Delete one account's stored key (best-effort). */
export async function deleteKey(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(PK_PREFIX + id).catch(() => undefined);
}

/** Delete the legacy single-key location (best-effort). */
export async function clearLegacyKey(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_PK_KEY).catch(() => undefined);
}

// ===========================================================================
// Railgun key material — derived IN PLACE from the EOA key (0zk wallet keyed off
// the same EOA, deterministically) so the raw key never leaves the module.
// ===========================================================================

export interface RailgunKeyMaterial {
  /** 12-word BIP39 mnemonic deterministically derived from the EOA key. */
  mnemonic: string;
  /** 32-byte engine encryption key, hex (no 0x). */
  encryptionKey: string;
}

/** Derive RAILGUN key material for an account id, in place. null when the account has no in-app key (WalletConnect). The raw EOA key is read here, never returned; the keccak derivation (lib/railgun/deriveKeys, pure) is applied in-module. */
export async function railgunKeyMaterialFor(id: string): Promise<RailgunKeyMaterial | null> {
  const pk = await loadPrivateKey(id);
  if (!pk) return null;
  const { mnemonicFromPrivateKey, encryptionKeyFromPrivateKey } = await import('../railgun/deriveKeys');
  return {
    mnemonic: mnemonicFromPrivateKey(pk),
    encryptionKey: encryptionKeyFromPrivateKey(pk),
  };
}

// ===========================================================================
// THE TWO GUARDED REVEALS — the only paths that return raw secrets.
// ===========================================================================

/** REVEAL the recovery phrase for the backup screen. Gated by `requireRevealAuth` (passkey when set, else device-auth) before the read. The ONLY path that returns the mnemonic. Never logged. null if none stored or the gate is declined/fails. */
export async function revealRecoveryPhrase(): Promise<string | null> {
  if (!(await requireRevealAuth())) return null;
  return readMnemonic();
}

/** REVEAL a single account's raw private key for the explicit "Export private key" action (UI also gates it behind a destructive Alert). Same `requireRevealAuth` gate, scoped to `id`. The ONLY path that returns an EOA raw key. Never logged. */
export async function revealPrivateKey(id: string): Promise<Hex | null> {
  if (!(await requireRevealAuth(id))) return null;
  return loadPrivateKey(id);
}
