import { getActiveAccountStrict } from './accounts';
import { getAccountEpoch } from './accountEpoch';
import { cachedSelfEthAddress } from './xmtp.client';
import { sdk } from './xmtp.sdk';
import { AccountChangedError, NoAccountError, clientScope } from './accountSelection';

export async function accountClient(onlyFor?: string) {
  const epoch = getAccountEpoch();
  const account = await getActiveAccountStrict();
  if (!account) throw new NoAccountError();
  if (onlyFor !== undefined && onlyFor !== account.id) throw new AccountChangedError();
  const client = await sdk.client();
  const scope = clientScope(client, sdk.cachedClient, epoch);
  const current = (): boolean => scope.current() && cachedSelfEthAddress()?.toLowerCase() === account.address.toLowerCase();
  const assertCurrent = (): void => {
    scope.assertCurrent();
    if (!current()) throw new AccountChangedError('Messaging client does not match the active account');
  };
  assertCurrent();
  if ((await getActiveAccountStrict())?.id !== account.id) throw new AccountChangedError();
  assertCurrent();
  return { account, client, current, assertCurrent };
}

export type AccountClient = Awaited<ReturnType<typeof accountClient>>;
