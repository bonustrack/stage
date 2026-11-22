import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

export interface PrivySession {
  address: string;
  method: PrivyLoginMethod;
}

export type PrivyLoginPurpose = 'login' | 'reauth';

export interface PrivyController {
  login: (method: PrivyLoginMethod, purpose: PrivyLoginPurpose) => Promise<PrivySession>;
  sendEmailCode: (email: string) => Promise<void>;
  loginWithEmail: (email: string, code: string) => Promise<PrivySession>;
  provider: (account: PrivySession) => Promise<Eip1193Provider>;
  forget: (account: PrivySession) => Promise<void>;
}
