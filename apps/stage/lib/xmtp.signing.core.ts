import type { Hex } from 'viem';
import { getViemAccount, type AccountRecord } from './accounts';

export interface SigningKey {
  kind: 'EOA' | 'SCW';
  address: string;
  chainId: number;
  signMessage: (message: string) => Promise<Hex>;
}

async function smartSigningKey(rec: AccountRecord): Promise<SigningKey> {
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  if (rec.scwXmtp === false) {
    const { smartOwnerAddress, signOwnerMessage } = await import('./zerodev/keyring');
    const ref = { hdIndex: rec.hdIndex, phraseId: rec.phraseId };
    return {
      kind: 'EOA', address: await smartOwnerAddress(ref), chainId: 1,
      signMessage: (message) => signOwnerMessage(ref, message),
    };
  }
  const { kernelClientForRecord } = await import('./zerodev/kernelForRecord');
  const { SCW_CHAIN_ID } = await import('@stage-labs/client/zerodev/config');
  const kernelClient = await kernelClientForRecord(rec, 'sign');
  return {
    kind: 'SCW', address: rec.address, chainId: SCW_CHAIN_ID,
    signMessage: (message) => kernelClient.signMessage({ message } as Parameters<typeof kernelClient.signMessage>[0]),
  };
}

export async function signingKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  if (rec.type === 'smart') return smartSigningKey(rec);
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return { kind: 'EOA', address: acct.address, chainId: 1, signMessage: (message) => acct.signMessage({ message }) };
}

export type SigningIdentity = Omit<SigningKey, 'signMessage'>;

export async function signingIdentityForRecord(rec: AccountRecord): Promise<SigningIdentity> {
  if (rec.type !== 'smart') {
    const acct = await getViemAccount(rec.id);
    if (!acct) throw new Error('No signing key for this account.');
    return { kind: 'EOA', address: acct.address, chainId: 1 };
  }
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  if (rec.scwXmtp === false) {
    const { smartOwnerAddress } = await import('./zerodev/keyring');
    return { kind: 'EOA', address: await smartOwnerAddress({ hdIndex: rec.hdIndex, phraseId: rec.phraseId }), chainId: 1 };
  }
  const { SCW_CHAIN_ID } = await import('@stage-labs/client/zerodev/config');
  return { kind: 'SCW', address: rec.address, chainId: SCW_CHAIN_ID };
}

export async function lazySigningKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  const identity = await signingIdentityForRecord(rec);
  let pending: Promise<SigningKey> | null = null;
  const resolveKey = (): Promise<SigningKey> => {
    pending ??= signingKeyForRecord(rec);
    pending.catch(() => { pending = null; });
    return pending;
  };
  return { ...identity, signMessage: async (message) => (await resolveKey()).signMessage(message) };
}
