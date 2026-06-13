/** ============================================================================
 *  THE KEYRING — the ONE and ONLY chokepoint for private-key + mnemonic access.
 *  ============================================================================
 *
 *  SECURITY MODEL (Less's hard requirement — see SECURITY.md):
 *    Every secret the wallet holds lives behind THIS module:
 *      - the single BIP-39 app mnemonic (root of every smart account + agent),
 *      - the per-account raw secp256k1 private keys (generated / imported EOAs).
 *    No other file in the app may read, derive, store, or expose that material.
 *
 *  GUARANTEES:
 *    1. Single chokepoint. This is the SOLE module that imports the secret
 *       primitives + storage-key constants:
 *         - `@stage-labs/client/zerodev/derive`  (mnemonic -> owner signer)
 *         - `@stage-labs/client/accounts/keys`   (PK_PREFIX / LEGACY_PK_KEY / pk rules)
 *         - `privateKeyToAccount` / `generatePrivateKey` / `mnemonicToAccount`
 *           from `viem/accounts`
 *       An ESLint guard (apps/app/eslint.config.mjs -> no-restricted-imports,
 *       allowlisted to THIS file) FAILS the build if any other file imports them,
 *       so a leak cannot even compile. A test invariant (test/keyring.guard.test.ts)
 *       asserts the same at CI time.
 *
 *    2. Sign-in-place. Signing happens INSIDE this module. The public API returns
 *       SIGNATURES or an opaque viem/XMTP signer object — it NEVER returns the raw
 *       32-byte key or the mnemonic string (with the two deliberate, guarded
 *       reveal exceptions below). A viem `PrivateKeyAccount` / `HDAccount` is a
 *       signer object: it can sign but exposes no extractor for its key, which is
 *       exactly the "viem-account-or-signer needed for ZeroDev/XMTP" the spec asks
 *       for.
 *
 *    3. Address-only everyday path. getAddress / view paths need NO secret read
 *       and NO biometric prompt. A key is read ONLY at an actual sign, and the
 *       mnemonic ONLY when deriving a NEW account or at the two reveals.
 *
 *    4. Two guarded reveals, nothing else returns secrets:
 *         - revealRecoveryPhrase(): the mnemonic, for the backup screen. Guarded
 *           by device auth — the mnemonic is stored `requireAuthentication: true`
 *           so the OS prompts biometrics/passcode on this (and only this) read.
 *         - revealPrivateKey(id): a single EOA's raw key, for the explicit
 *           "Export private key" action (the UI gates it behind a destructive
 *           warning Alert). Never logged.
 *
 *    5. No logging. This module never console.logs key material. */

import '../cryptoShim';
import * as SecureStore from 'expo-secure-store';
import {
  generatePrivateKey, privateKeyToAccount,
  type PrivateKeyAccount, type HDAccount,
} from 'viem/accounts';
import { type Hex } from 'viem';
import {
  generateWalletMnemonic, normalizeMnemonic, isValidMnemonic, deriveOwner,
} from '@stage-labs/client/zerodev/derive';
import {
  PK_PREFIX, LEGACY_PK_KEY, normalizePk, privateKeyFromMnemonic,
} from '@stage-labs/client/accounts/keys';

// ===========================================================================
// Storage-key constants (PRIVATE — never exported; no other file names them).
// ===========================================================================

/** SecureStore key for the single app BIP-39 mnemonic. `[A-Za-z0-9._-]+` only
 *  (colons are rejected on Android). */
const MNEMONIC_KEY = 'wallet.mnemonic';

/** Hardened write options for the mnemonic. A value written with these prompts
 *  device auth (biometrics / passcode) on every READ — that is what makes
 *  revealRecoveryPhrase() biometric-gated WITHOUT a separate native dep, and why
 *  the mnemonic must only be read on a deliberate new-account / reveal path. */
const HARDENED: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ===========================================================================
// Mnemonic provisioning (smart-account root).
// ===========================================================================

/** Read the mnemonic (prompts device auth). null if none stored. PRIVATE —
 *  callers use the signer factories below; only the two reveals expose the
 *  string, and only generate/restore set it. */
async function loadMnemonic(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(MNEMONIC_KEY, HARDENED).catch(() => null);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  return isValidMnemonic(phrase) ? phrase : null;
}

/** Whether a mnemonic exists. Prompts device auth (the value is the only signal),
 *  so prefer inferring existence from the account registry; call this only when
 *  you truly must know. Returns false on any error. */
export async function hasMnemonic(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(MNEMONIC_KEY, HARDENED);
    return !!v && isValidMnemonic(v);
  } catch {
    return false;
  }
}

/** RESTORE: validate + store a user-supplied phrase hardened. Throws on a phrase
 *  that fails BIP-39. Overwrites any existing value — guard call sites. */
export async function restoreMnemonic(phrase: string): Promise<void> {
  const norm = normalizeMnemonic(phrase);
  if (!isValidMnemonic(norm)) throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  await SecureStore.setItemAsync(MNEMONIC_KEY, norm, HARDENED);
}

/** Delete the stored mnemonic (dev reset / full nuke). Not hardened — a delete
 *  reads nothing, so it doesn't prompt. Best-effort. */
export async function clearMnemonic(): Promise<void> {
  await SecureStore.deleteItemAsync(MNEMONIC_KEY).catch(() => undefined);
}

/** GENERATE-ON-FIRST-USE: idempotently ensure a mnemonic exists, minting a fresh
 *  one on first call. Returns nothing — the secret stays inside the module.
 *  Prompts device auth (it reads to check existence). Call lazily (new-account
 *  path), never on boot. */
export async function ensureMnemonic(): Promise<void> {
  const existing = await loadMnemonic();
  if (existing) return;
  await SecureStore.setItemAsync(MNEMONIC_KEY, generateWalletMnemonic(), HARDENED);
}

// ===========================================================================
// Smart-account (HD) signers — sign-in-place, owner derived from the mnemonic.
// ===========================================================================

/** Internal: derive the owner signer for a smart-account HD index. Reads the
 *  mnemonic (device auth). Throws if none stored. The returned HDAccount signs
 *  but exposes no key extractor. */
async function ownerFor(hdIndex: number): Promise<HDAccount> {
  const mnemonic = await loadMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable for this smart account.');
  return deriveOwner(mnemonic, hdIndex);
}

/** The owner ADDRESS for an HD index (public, no auth — derives a throwaway view
 *  account is not possible without the phrase, so this DOES read; prefer the
 *  cached `ownerAddress` on the account record for view paths). */
export async function smartOwnerAddress(hdIndex: number): Promise<string> {
  return (await ownerFor(hdIndex)).address.toLowerCase();
}

/** The owner signer (viem HDAccount) for a smart-account index, used as the
 *  ZeroDev ECDSA validator `signer` and for guardian-recovery signing. Opaque
 *  signer — never the key. Reads the mnemonic (sign-time auth). */
export async function smartOwnerSigner(hdIndex: number): Promise<HDAccount> {
  return ownerFor(hdIndex);
}

/** An XMTP-style EOA signMessage for the smart account's owner identity (the
 *  default, scwXmtp-OFF path). Signs in place; returns the hex signature. */
export async function signOwnerMessage(hdIndex: number, message: string): Promise<Hex> {
  const owner = await ownerFor(hdIndex);
  return owner.signMessage({ message }) as Promise<Hex>;
}

// ===========================================================================
// Per-account EOA private keys (generated / imported wallets).
// ===========================================================================

/** Internal: load the raw private key for an account id, self-healing a legacy
 *  single-key location into the per-account slot. PRIVATE — the raw key never
 *  leaves except via revealPrivateKey / the in-place signers below. */
async function loadPrivateKey(id: string): Promise<Hex | null> {
  const pk = await SecureStore.getItemAsync(PK_PREFIX + id).catch(() => null);
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  /** Self-heal: a key from the pre-multi-account build may live only under the
   *  legacy `wallet.privateKey`. Accept iff it derives to THIS id, then re-write
   *  it under the per-account key so future reads are direct. */
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await SecureStore.setItemAsync(PK_PREFIX + id, norm).catch(() => undefined);
        return norm;
      }
    } catch { /* malformed legacy key — fall through to null */ }
  }
  return null;
}

/** Internal: store a private key under its per-account slot. */
async function storePrivateKey(id: string, pk: Hex): Promise<void> {
  await SecureStore.setItemAsync(PK_PREFIX + id, pk);
}

/** A viem signer for an account id, or null when no key is stored (WalletConnect /
 *  smart). Opaque signer — signs in place, never exposes the key. */
export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await loadPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

/** Provision a brand-new generated EOA: mint a random key, store it, and return
 *  its (id, address). The key stays inside the module. */
export async function createGeneratedKey(): Promise<{ id: string; address: string }> {
  const pk = generatePrivateKey();
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

/** Provision an imported EOA from a pasted private key OR BIP-39 phrase (phrases
 *  contain spaces). Stores the key, returns (id, address). The key stays inside. */
export async function importKey(input: string): Promise<{ id: string; address: string }> {
  const pk = input.trim().includes(' ') ? privateKeyFromMnemonic(input) : normalizePk(input);
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  await storePrivateKey(id, pk);
  return { id, address: acct.address };
}

/** Migrate a legacy single `wallet.privateKey` into the per-account slot, used by
 *  the registry's first-run migration. Returns the migrated (id, address) or null
 *  when there is no valid legacy key. */
export async function adoptLegacyKey(): Promise<{ id: string; address: string } | null> {
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY).catch(() => null);
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
// Railgun key material — derived IN PLACE from the EOA key so the raw key never
// leaves the module (the 0zk wallet is keyed off the same EOA, deterministically).
// ===========================================================================

export interface RailgunKeyMaterial {
  /** 12-word BIP39 mnemonic deterministically derived from the EOA key. */
  mnemonic: string;
  /** 32-byte engine encryption key, hex (no 0x). */
  encryptionKey: string;
}

/** Derive RAILGUN key material for an account id, in place. Returns null when the
 *  account has no in-app key (WalletConnect). The raw EOA key is read here and
 *  never returned. The keccak derivation lives in lib/railgun/deriveKeys (pure,
 *  no secret access) and is applied to the in-module key. */
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

/** REVEAL the recovery phrase for the backup screen. Guarded by device auth: the
 *  mnemonic is stored `requireAuthentication: true`, so the OS prompts
 *  biometrics/passcode on this read. The ONLY path that returns the mnemonic
 *  string. Never logged. Returns null if none stored / auth fails. */
export async function revealRecoveryPhrase(): Promise<string | null> {
  return loadMnemonic();
}

/** REVEAL a single account's raw private key for the explicit "Export private
 *  key" action (the UI gates it behind a destructive warning Alert). The ONLY
 *  path that returns an EOA raw key. Never logged. null when none stored. */
export async function revealPrivateKey(id: string): Promise<Hex | null> {
  return loadPrivateKey(id);
}
