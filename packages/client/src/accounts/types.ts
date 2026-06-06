/** Shared account-record types for the multi-account registry. The app holds
 *  several wallets at once and switches without a logout; each account is one of
 *  'generated' (a random in-app EOA), 'privateKey' (imported), or
 *  'walletconnect' (remote — no key stored).
 *
 *  Framework-agnostic — the registry RULES live in ./registry; key STORAGE
 *  stays in the host behind the injected SecureStorage interface. */

export type AccountType = 'generated' | 'privateKey' | 'walletconnect';

export interface AccountRecord {
  /** Lowercased address — stable, storage-key-safe identifier. */
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
}
