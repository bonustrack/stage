import { getActiveAccount } from './accounts';
import { getAccountEpoch } from './accountEpoch';
import { cachedSelfEthAddress } from './xmtp.client';
import { sdk } from './xmtp.sdk';

export async function accountClient(onlyFor?: string) {
  const epoch = getAccountEpoch();
  const account = await getActiveAccount();
  if (!account || (onlyFor !== undefined && onlyFor !== account.id)) throw new Error('Messaging account changed');
  const client = await sdk.client();
  const current = (): boolean => getAccountEpoch() === epoch && sdk.cachedClient() === client
    && cachedSelfEthAddress()?.toLowerCase() === account.address.toLowerCase();
  const assertCurrent = (): void => { if (!current()) throw new Error('Messaging account changed'); };
  assertCurrent();
  if ((await getActiveAccount())?.id !== account.id) throw new Error('Messaging account changed');
  assertCurrent();
  return { account, client, current, assertCurrent };
}

export type AccountClient = Awaited<ReturnType<typeof accountClient>>;
