/** The single app BIP-39 mnemonic: generate-on-first-use + hardened load/store.
 *
 *  KEY MODEL (locked): ONE mnemonic is the root for every smart account AND every
 *  agent. Each account = the next HD index off this phrase (see
 *  @stage-labs/client/zerodev/derive). It is the ONLY secret we store for the
 *  smart-account feature — no per-account keys, no passkey private key (that
 *  lives in the Secure Enclave, never here).
 *
 *  Hardening (spec 3.4): stored with `requireAuthentication: true` +
 *  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (iOS: not synced, not iCloud-backed; Android:
 *  AndroidKeyStore hardware-backed where available, read gated by device auth).
 *
 *  HOT-PATH INVARIANT: `requireAuthentication: true` prompts biometrics on every
 *  READ, so the mnemonic must only be read when (a) deriving a NEW account owner
 *  or (b) exporting the backup phrase — NEVER on a normal userOp (those are
 *  signed by the passkey or a cached derived signer). Do not read this on boot. */

import '../cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { generateWalletMnemonic, normalizeMnemonic, isValidMnemonic } from '@stage-labs/client/zerodev/derive';

/** SecureStore key — `[A-Za-z0-9._-]+` only (colons are rejected on Android). */
const MNEMONIC_KEY = 'wallet.mnemonic';

/** Hardened write options. Reads of a value written with these prompt device
 *  auth (biometrics / passcode), so callers must respect the hot-path invariant. */
const HARDENED: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Whether a mnemonic exists yet. Uses a NON-hardened existence probe is not
 *  possible (the value is the only signal), so this WILL prompt auth on a value
 *  written hardened. Prefer tracking existence via the account registry (a
 *  `smart` record implies a mnemonic) and only call this when you truly need the
 *  phrase. Returns false on any error (treat as "not set"). */
export async function hasMnemonic(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(MNEMONIC_KEY, HARDENED);
    return !!v && isValidMnemonic(v);
  } catch {
    return false;
  }
}

/** Read the mnemonic (prompts device auth). Returns null if none is stored.
 *  HOT-PATH WARNING: only call when deriving a new account or exporting backup. */
export async function getMnemonic(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(MNEMONIC_KEY, HARDENED).catch(() => null);
  if (!raw) return null;
  const phrase = normalizeMnemonic(raw);
  return isValidMnemonic(phrase) ? phrase : null;
}

/** Store a mnemonic hardened. Overwrites any existing value — guard call sites so
 *  we never clobber the user's phrase (see ensureMnemonic). */
export async function setMnemonic(phrase: string): Promise<void> {
  const norm = normalizeMnemonic(phrase);
  if (!isValidMnemonic(norm)) throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  await SecureStore.setItemAsync(MNEMONIC_KEY, norm, HARDENED);
}

/** Idempotently ensure a mnemonic exists, generating one on first use, and
 *  return it. Prompts device auth (it reads). Call this lazily — only when the
 *  user first creates a smart account, never on boot. */
export async function ensureMnemonic(): Promise<string> {
  const existing = await getMnemonic();
  if (existing) return existing;
  const fresh = generateWalletMnemonic();
  await setMnemonic(fresh);
  return fresh;
}
