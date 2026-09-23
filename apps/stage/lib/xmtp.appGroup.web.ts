import type { XmtpEnv } from './xmtp.types';

export interface PushAccount {
  id: string;
  address: string;
  inboxId: string;
  dbDir: string;
  env: XmtpEnv;
}

export const XMTP_APP_GROUP: string | null = null;

export function sharedStoreRoot(): null {
  return null;
}

export function recordPushAccount(account: PushAccount): void {
  void account;
}

export function forgetPushAccount(accountId: string): void {
  void accountId;
}
