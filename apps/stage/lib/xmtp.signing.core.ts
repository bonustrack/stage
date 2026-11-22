import type { Hex } from 'viem';
import type { AccountRecord } from './accounts';
import { eoaSignerFor } from './eoaSigner';
import { privySignStable } from './privySigner';

type SignMessage = (message: string) => Promise<Hex>;

interface SigningKey {
  kind: 'EOA' | 'SCW';
  address: string;
  chainId: number;
  signMessage: SignMessage;
  signStable: SignMessage;
}

async function smartSigningKey(rec: AccountRecord): Promise<SigningKey> {
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  const { kernelClientForRecord } = await import('./zerodev/client');
  const { SCW_CHAIN_ID } = await import('@stage-labs/client/zerodev/config');
  const kernelClient = await kernelClientForRecord(rec);
  const signMessage: SignMessage = (message) => kernelClient.signMessage({ message } as Parameters<typeof kernelClient.signMessage>[0]);
  return { kind: 'SCW', address: rec.address, chainId: SCW_CHAIN_ID, signMessage, signStable: signMessage };
}

export async function signingKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  if (rec.type === 'smart') return smartSigningKey(rec);
  const signer = await eoaSignerFor(rec);
  if (!signer) throw new Error('No signing key for this account.');
  const signMessage: SignMessage = (message) => signer.signMessage({ message });
  const signStable: SignMessage = rec.type === 'privy' ? (message) => privySignStable(rec, message) : signMessage;
  return { kind: 'EOA', address: signer.address, chainId: 1, signMessage, signStable };
}

type SigningIdentity = Omit<SigningKey, 'signMessage' | 'signStable'>;

async function signingIdentityForRecord(rec: AccountRecord): Promise<SigningIdentity> {
  if (rec.type !== 'smart') return { kind: 'EOA', address: rec.address, chainId: 1 };
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  const { SCW_CHAIN_ID } = await import('@stage-labs/client/zerodev/config');
  return { kind: 'SCW', address: rec.address, chainId: SCW_CHAIN_ID };
}

export async function lazySigningKeyForRecord(rec: AccountRecord): Promise<SigningKey> {
  const identity = await signingIdentityForRecord(rec);
  let pending: Promise<SigningKey> | null = null;
  const resolveKey = (): Promise<SigningKey> => {
    pending ??= signingKeyForRecord(rec);
    pending.catch(() => {
      pending = null;
    });
    return pending;
  };
  return {
    ...identity,
    signMessage: async (message) => (await resolveKey()).signMessage(message),
    signStable: async (message) => (await resolveKey()).signStable(message),
  };
}
