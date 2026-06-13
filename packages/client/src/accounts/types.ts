/** Shared account-record types for the multi-account registry. The app holds
 *  several wallets at once and switches without a logout; each account is one of
 *  'generated' (a random in-app EOA), 'privateKey' (imported), or
 *  'walletconnect' (remote — no key stored).
 *
 *  Framework-agnostic — the registry RULES live in ./registry; key STORAGE
 *  stays in the host behind the injected SecureStorage interface. */

export type AccountType = 'generated' | 'privateKey' | 'walletconnect' | 'smart';

export interface AccountRecord {
  /** Lowercased address — stable, storage-key-safe identifier. For a `smart`
   *  account this is the COUNTERFACTUAL Kernel address (not an EOA). */
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
  /** The mnemonic-derived ECDSA backup owner address (lowercased). Not stored as
   *  a key — re-derived from the mnemonic at hdIndex on demand. */
  ownerAddress?: string;
  /** base64url passkey rawId — CACHE only (resident credential means restore can
   *  pass allowCredentials:[]); treat as disposable. */
  passkeyCredId?: string;
  /** The Kernel has been deployed on-chain (first sponsored userOp landed). The
   *  account is usable counterfactually before this is true. */
  deployed?: boolean;
  /** OPT-IN cutover: when true, this account's XMTP identity is the SCW (Kernel)
   *  address signed via ERC-1271/6492. Default OFF — until the on-device 6492
   *  smoke test passes, even smart accounts keep the legacy EOA XMTP signer so
   *  existing inboxes are never disrupted. A fresh inbox at the SCW address (no
   *  migration) once enabled. */
  scwXmtp?: boolean;

  /** Guardian social recovery (phase 2), display only — the source of truth is
   *  the on-chain weighted-ECDSA validator. Guardian friend addresses (lowercased). */
  guardians?: string[];
  /** "M of N" — the integer threshold of guardians required to rotate the owner. */
  guardianThreshold?: number;
  /** The on-chain recovery timelock window in seconds (native validator `delay`). */
  guardianDelay?: number;
}
