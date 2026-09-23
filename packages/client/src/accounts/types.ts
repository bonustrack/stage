
export type AccountType = 'smart' | 'generated' | 'privateKey';

export const ACCOUNT_TYPES: readonly AccountType[] = ['smart', 'generated', 'privateKey'];

export interface AccountRecord {
  id: string;
  address: string;
  type: AccountType;
  label?: string;
  dbDir: string;
  registered?: boolean;
  createdAt: number;

  hdIndex?: number;
  phraseId?: string;
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

}
