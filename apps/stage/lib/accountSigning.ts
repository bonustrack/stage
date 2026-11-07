import type { Hex } from 'viem';
import { getViemAccount } from './zerodev/keyring';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { memoized } from './storeCore';

interface SigningKey {
  kind: 'EOA' | 'SCW';
  address: string;
  chainId: number;
  signMessage: (message: string) => Promise<Hex>;
}

async function signingIdentityForRecord(rec: AccountRecord): Promise<Omit<SigningKey, 'signMessage'>> {
  if (rec.type !== 'smart') return { kind: 'EOA', address: rec.address, chainId: 1 };
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  const { WALLET_CHAIN_ID } = await import('@stage-labs/client/wallet/chains');
  return { kind: 'SCW', address: rec.address, chainId: WALLET_CHAIN_ID };
}

export async function signingKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  if (rec.type === 'smart') {
    const identity = await signingIdentityForRecord(rec);
    const { kernelClientForRecord } = await import('./zerodev/client');
    const kernelClient = await kernelClientForRecord(rec);
    return { ...identity, signMessage: (message) => kernelClient.signMessage({ message }) };
  }
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return { kind: 'EOA', address: acct.address, chainId: 1, signMessage: (message) => acct.signMessage({ message }) };
}

export async function lazySigningKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  const identity = await signingIdentityForRecord(rec);
  const keys = new Map<string, Promise<SigningKey>>();
  const resolveKey = (): Promise<SigningKey> => memoized(keys, rec.id, () => signingKeyForRecord(rec));
  return { ...identity, signMessage: async (message) => (await resolveKey()).signMessage(message) };
}
