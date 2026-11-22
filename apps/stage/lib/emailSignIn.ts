import type { PrivySession } from './privy.types';
import { privyLoginWithEmail, privySendEmailCode, wantPrivyHost } from './privyBridge';
import { SignInCancelled } from './signInCancelled';
import { makeValue } from './storeCore';
import { makeDeferred, type Deferred } from './watched';

export interface EmailSignInView {
  sentTo: string | null;
}

const view = makeValue<EmailSignInView | null>(null);
let pending: Deferred<PrivySession> | null = null;

export const useEmailSignIn = view.use;

export function requestEmailSignIn(): Promise<PrivySession> {
  cancelEmailSignIn();
  pending = makeDeferred<PrivySession>();
  view.set({ sentTo: null });
  wantPrivyHost();
  return pending.promise;
}

export async function sendEmailSignInCode(email: string): Promise<void> {
  await privySendEmailCode(email);
  if (pending !== null) view.set({ sentTo: email });
}

export async function finishEmailSignIn(code: string): Promise<void> {
  const email = view.get()?.sentTo ?? null;
  if (email === null) throw new Error('Enter your email first.');
  const session = await privyLoginWithEmail(email, code);
  const done = pending;
  pending = null;
  view.set(null);
  done?.resolve(session);
}

export function changeEmailSignInAddress(): void {
  if (pending !== null) view.set({ sentTo: null });
}

export function cancelEmailSignIn(): void {
  pending?.reject(new SignInCancelled());
  pending = null;
  view.set(null);
}
