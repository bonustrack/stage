
export type AccountType = 'smart' | 'generated' | 'privateKey' | 'walletconnect';

export interface AccountRecord {
  id: string;
  address: string;
  type: AccountType;
  label?: string;
  dbDir: string;
  registered?: boolean;
  createdAt: number;

  hdIndex?: number;
  ownerAddress?: string;
  passkeyCredId?: string;
  passkey?: {
    pubX: string;
    pubY: string;
    authenticatorId: string;
    authenticatorIdHash: string;
    rpID: string;
  };
  passkeySudo?: boolean;
  deployed?: boolean;
  scwXmtp?: boolean;

  guardians?: string[];
  guardianThreshold?: number;
  guardianDelay?: number;
}
