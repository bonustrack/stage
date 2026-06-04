/** Shared account record types — leaf module imported by accounts.ts and accounts.keys.ts. */

export type AccountType = 'generated' | 'privateKey' | 'walletconnect';

export interface AccountRecord {
  /** Lowercased address — stable, SecureStore-key-safe identifier. */
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
