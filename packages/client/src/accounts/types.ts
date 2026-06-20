/** @file Shared AccountRecord/AccountType types for the multi-account registry: every account is a mnemonic-derived ZeroDev Kernel `smart` account (legacy generated/privateKey/walletconnect kept only for deserializing old records); framework-agnostic, with rules in ./registry and key storage in the host. */

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

  /** `smart` (ZeroDev Kernel) accounts only: which HD index off the single app mnemonic backs this account's owner. */
  hdIndex?: number;
  /** The mnemonic-derived ECDSA backup owner address (lowercased). Not stored as a key — re-derived from the mnemonic at hdIndex on demand. */
  ownerAddress?: string;
  /** base64url passkey rawId — CACHE only (resident credential means restore can pass allowCredentials:[]); treat as disposable. */
  passkeyCredId?: string;
  /** When set, the device passkey (WebAuthn) is the active signer for every path via the ZeroDev passkey validator (sudo) and the ECDSA owner is only the backup; holds the public WebAuthnKey material (pubX/pubY hex, bigint not JSON-safe) to rebuild the validator without re-registering. */
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
  /** True when `address` derives from the passkey validator as `sudo` (passkey in the CREATE2 salt), so the Kernel rebuilds with no address override; false/undefined when it derives from the ECDSA owner, where kernelForRecord must pin the passkey-sudo Kernel to `address` to keep the wallet identity. */
  passkeySudo?: boolean;
  /** The Kernel has been deployed on-chain (first sponsored userOp landed). The account is usable counterfactually before this is true. */
  deployed?: boolean;
  /** Opt-in cutover: when true the XMTP identity is the SCW (Kernel) address signed via ERC-1271/6492; default off so smart accounts keep the legacy EOA XMTP signer (and existing inboxes) until the on-device 6492 smoke test passes, then a fresh inbox at the SCW address. */
  scwXmtp?: boolean;

  /** Guardian social recovery (phase 2), display only — the source of truth is the on-chain weighted-ECDSA validator. Guardian friend addresses (lowercased). */
  guardians?: string[];
  /** "M of N" — the integer threshold of guardians required to rotate the owner. */
  guardianThreshold?: number;
  /** The on-chain recovery timelock window in seconds (native validator `delay`). */
  guardianDelay?: number;
}
