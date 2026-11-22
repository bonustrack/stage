import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { appStorage } from '../platform/storage';
import { ignored } from './errorPolicy';
import { PRIVY_APP_ID } from './privyConfig';
import { parsePendingLogin, type PendingPrivyLogin } from './privyPending.model';
import { returnedOAuthProvider } from './privyReturn';
import type { Eip1193Provider, PrivyController, PrivyLoginPurpose, PrivySession } from './privy.types';
import { makeValue } from './storeCore';

const CONTROLLER_TIMEOUT_MS = 30_000;
const PENDING_KEY = 'privy.pendingLogin';

export async function writePendingPrivyLogin(method: PrivyLoginMethod, purpose: PrivyLoginPurpose): Promise<void> {
  await appStorage.set(PENDING_KEY, JSON.stringify({ method, purpose, at: Date.now() } satisfies PendingPrivyLogin));
}

export async function clearPendingPrivyLogin(): Promise<void> {
  await appStorage.delete(PENDING_KEY).catch(ignored(undefined, 'cleanup'));
}

const returning = makeValue(PRIVY_APP_ID !== undefined && returnedOAuthProvider() !== null);

export const usePrivyReturning = returning.use;

export function returnedPrivyMethod(): PrivyLoginMethod | null {
  const provider = returnedOAuthProvider();
  if (provider === null || !returning.get()) return null;
  return provider === 'google' || provider === 'github' ? provider : 'microsoft';
}

export function privyReturnHandled(): void {
  if (returning.get()) returning.set(false);
}

export async function returnedPrivyLogin(): Promise<PendingPrivyLogin | null> {
  if (returnedOAuthProvider() === null) return null;
  return parsePendingLogin(await appStorage.get(PENDING_KEY), Date.now());
}

interface Waiter {
  resolve: (next: PrivyController) => void;
  reject: (reason: Error) => void;
}

const wanted = makeValue(false);
const waiting = new Set<Waiter>();
let controller: PrivyController | null = null;

export const usePrivyHostWanted = wanted.use;

export function wantPrivyHost(): void {
  if (PRIVY_APP_ID !== undefined && !wanted.get()) wanted.set(true);
}

export function registerPrivyController(next: PrivyController): () => void {
  controller = next;
  for (const waiter of waiting) waiter.resolve(next);
  waiting.clear();
  return () => {
    if (controller === next) controller = null;
  };
}

export function privyHostFailed(reason: Error): void {
  controller = null;
  for (const waiter of waiting) waiter.reject(reason);
  waiting.clear();
  wanted.set(false);
}

function privyController(): Promise<PrivyController> {
  if (PRIVY_APP_ID === undefined) return Promise.reject(new Error('This build has no Privy sign-in.'));
  if (controller !== null) return Promise.resolve(controller);
  wantPrivyHost();
  return new Promise((resolve, reject) => {
    const waiter: Waiter = {
      resolve: (next) => {
        clearTimeout(timer);
        resolve(next);
      },
      reject: (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    };
    const timer = setTimeout(() => {
      waiting.delete(waiter);
      reject(new Error('Sign-in could not start. Check your connection and try again.'));
    }, CONTROLLER_TIMEOUT_MS);
    waiting.add(waiter);
  });
}

export async function privyLogin(method: PrivyLoginMethod, purpose: PrivyLoginPurpose = 'login'): Promise<PrivySession> {
  return (await privyController()).login(method, purpose);
}

export async function privySendEmailCode(email: string): Promise<void> {
  await (await privyController()).sendEmailCode(email);
}

export async function privyLoginWithEmail(email: string, code: string): Promise<PrivySession> {
  return (await privyController()).loginWithEmail(email, code);
}

export async function privyProvider(account: PrivySession): Promise<Eip1193Provider> {
  return (await privyController()).provider(account);
}

export async function privyForget(account: PrivySession): Promise<void> {
  await (await privyController()).forget(account);
}
