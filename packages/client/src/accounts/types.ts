/**
 * @file Shared AccountRecord/AccountType definitions for the multi-account registry (smart Kernel accounts plus legacy compat).
 */
/**
 * Shared account-record types for the multi-account registry. The app holds
 *  several wallets at once and switches without a logout. Every account is a
 *  mnemonic-derived ZeroDev Kernel `smart` account (passkey signer when set,
 *  ECDSA owner fallback) — the ONLY account model.
 *
 *  The legacy values ('generated' | 'privateKey' | 'walletconnect') are kept in
 *  the union ONLY so an old on-device record deserializes without crashing; no
 *  code path creates them any more. A 'generated'/'privateKey' record is still
 *  treated as a local EOA (it has a stored key); 'walletconnect' is treated as a
 *  keyless remote signer. Both are backward-compat only and will be dropped once
 *  no device holds such a record.
 *
 *  Framework-agnostic — the registry RULES live in ./registry; key STORAGE
 *  stays in the host behind the injected SecureStorage interface.
 */

export type AccountType = 'smart' | 'generated' | 'privateKey' | 'walletconnect';

export interface AccountRecord {
  /** Lowercased address — stable, storage-key-safe identifier. For a `smart` account this is the COUNTERFACTUAL Kernel address (not an EOA). */
  id: string;
  /** Checksummed address for display + signing. */
  address: string;
  type: AccountType;
  label?: string;
  /** Dir name under the document dir for this account's XMTP store. */
  dbDir: string;
  /** An XMTP installation has been created in dbDir (so we Client.build, not create). */
  registered?: boolean;
  createdAt: number;

  /** --- `smart` (ZeroDev Kernel) accounts only --- */
  /** Which HD index off the single app mnemonic backs this account's owner. */
  hdIndex?: number;
  /** The mnemonic-derived ECDSA backup owner address (lowercased). Not stored as a key — re-derived from the mnemonic at hdIndex on demand. */
  ownerAddress?: string;
  /** base64url passkey rawId — CACHE only (resident credential means restore can pass allowCredentials:[]); treat as disposable. */
  passkeyCredId?: string;
  /**
   * When set, this account HAS a device passkey and the passkey (WebAuthn) is the
   *  ACTIVE signer for EVERY signing path (tx / userOp / signMessage / signTypedData)
   *  via the ZeroDev passkey validator (sudo). The mnemonic-derived ECDSA owner is
   *  only the `regular` backup validator and is NEVER used for signing while this is
   *  present. Holds exactly the public `WebAuthnKey` material needed to rebuild the
   *  passkey validator on later launches WITHOUT re-registering (no private key, no
   *  passkey server) — pubX/pubY are hex strings because bigint is not JSON-safe. The
   *  WebAuthn assertion itself happens on-device through react-native-passkeys.
   */
  passkey?: {
    /** P-256 public key X coordinate, hex (0x-prefixed). */
    pubX: string;
    /** P-256 public key Y coordinate, hex (0x-prefixed). */
    pubY: string;
    /** base64url credential id (the resident passkey rawId). */
    authenticatorId: string;
    /** keccak256(authenticatorId bytes), hex — the on-chain validator key id. */
    authenticatorIdHash: string;
    /** Relying-party id the passkey is scoped to. */
    rpID: string;
  };
  /**
   * TRUE when `address` was derived from the PASSKEY validator as `sudo` (the
   *  passkey was chosen at CREATE, so the passkey is part of this address's CREATE2
   *  salt). The Kernel is then rebuilt WITHOUT an address override — the natural
   *  passkey-sudo address equals `address`, the deploy initCode matches, and the
   *  first sponsored userOp deploys correctly with NO separate enable step.
   *
   *  FALSE/undefined when the address was derived from the ECDSA owner as `sudo`
   *  (ECDSA create, or a passkey ADDED later via enable). For those, kernelForRecord
   *  must pin the rebuilt passkey-sudo Kernel to `address` so swapping sudo does not
   *  change the wallet identity.
   */
  passkeySudo?: boolean;
  /** The Kernel has been deployed on-chain (first sponsored userOp landed). The account is usable counterfactually before this is true. */
  deployed?: boolean;
  /**
   * OPT-IN cutover: when true, this account's XMTP identity is the SCW (Kernel)
   *  address signed via ERC-1271/6492. Default OFF — until the on-device 6492
   *  smoke test passes, even smart accounts keep the legacy EOA XMTP signer so
   *  existing inboxes are never disrupted. A fresh inbox at the SCW address (no
   *  migration) once enabled.
   */
  scwXmtp?: boolean;

  /** Guardian social recovery (phase 2), display only — the source of truth is the on-chain weighted-ECDSA validator. Guardian friend addresses (lowercased). */
  guardians?: string[];
  /** "M of N" — the integer threshold of guardians required to rotate the owner. */
  guardianThreshold?: number;
  /** The on-chain recovery timelock window in seconds (native validator `delay`). */
  guardianDelay?: number;
}
