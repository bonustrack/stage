import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { requestEmailSignIn } from './emailSignIn';
import { connectExternalWallet } from './externalWallet';
import { privyLogin } from './privyBridge';
import type { PrivyLoginPurpose, PrivySession } from './privy.types';

export async function signInSession(method: PrivyLoginMethod, purpose: PrivyLoginPurpose = 'login'): Promise<PrivySession> {
  if (method === 'wallet') return { address: await connectExternalWallet(), method };
  if (method === 'email') return requestEmailSignIn();
  return privyLogin(method, purpose);
}
