import { useEffect } from 'react';
import { privyAppLogins } from '@stage-labs/client/accounts/privy';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { recover } from './errorPolicy';
import { PRIVY_APP_ID, privyLoginMethods, rememberMicrosoftProvider } from './privyConfig';
import { makeValue } from './storeCore';

const PRIVY_APPS_API = 'https://auth.privy.io/api/v1/apps/';
const CONFIG_TIMEOUT_MS = 8_000;

export type LoginMethodsState = { status: 'loading' } | { status: 'ready'; methods: PrivyLoginMethod[] };

function timeout(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('The Privy app config did not answer in time.'));
    }, CONFIG_TIMEOUT_MS);
  });
}

async function enabledSocials(appId: string): Promise<PrivyLoginMethod[]> {
  const res = await Promise.race([fetch(`${PRIVY_APPS_API}${appId}`, { headers: { 'privy-app-id': appId } }), timeout()]);
  if (!res.ok) throw new Error(`The Privy app config answered ${res.status}.`);
  const logins = privyAppLogins(await res.json());
  rememberMicrosoftProvider(logins.microsoftProvider);
  return logins.methods;
}

const state = makeValue<LoginMethodsState>(
  PRIVY_APP_ID === undefined ? { status: 'ready', methods: privyLoginMethods([]) } : { status: 'loading' },
);
let started = false;

function loadLoginMethods(): void {
  if (started || PRIVY_APP_ID === undefined) return;
  started = true;
  void enabledSocials(PRIVY_APP_ID)
    .catch(recover('privy.appConfig', []))
    .then((socials) => {
      state.set({ status: 'ready', methods: privyLoginMethods(socials) });
    });
}

export function useLoginMethods(): LoginMethodsState {
  useEffect(loadLoginMethods, []);
  return state.use();
}
