import { getActiveAccountStrict } from './accounts';
import { getAccountEpoch } from './accountEpoch';
import { cachedSelfEthAddress } from './xmtp.client';
import { sdk } from './xmtp.sdk';
import { AccountChangedError, NoAccountError } from './xmtp.client.core';

export async function accountClient(onlyFor?: string) {
  const epoch = getAccountEpoch();
  const account = await getActiveAccountStrict();
  if (!account) throw new NoAccountError();
  if (onlyFor !== undefined && onlyFor !== account.id) throw new AccountChangedError();
  const client = await sdk.client();
  const current = (): boolean => getAccountEpoch() === epoch && sdk.cachedClient() === client
    && cachedSelfEthAddress()?.toLowerCase() === account.address.toLowerCase();
  const assertCurrent = (): void => {
    if (getAccountEpoch() !== epoch || sdk.cachedClient() !== client) throw new AccountChangedError();
    if (!current()) throw new Error('Messaging client does not match the active account');
  };
  assertCurrent();
  if ((await getActiveAccountStrict())?.id !== account.id) throw new AccountChangedError();
  assertCurrent();
  return { account, client, current, assertCurrent };
}

export type AccountClient = Awaited<ReturnType<typeof accountClient>>;
