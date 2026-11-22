import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { connectExternalWallet } from './externalWallet';
import { privyLogin } from './privyBridge';
import type { PrivyLoginPurpose, PrivySession } from './privy.types';

export async function signInSession(method: PrivyLoginMethod, purpose: PrivyLoginPurpose = 'login'): Promise<PrivySession> {
  if (method === 'wallet') return { address: await connectExternalWallet(), method };
  return privyLogin(method, purpose);
}
