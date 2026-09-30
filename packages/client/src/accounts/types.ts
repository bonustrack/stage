
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
  deployed?: boolean;
  scwXmtp?: boolean;

}
