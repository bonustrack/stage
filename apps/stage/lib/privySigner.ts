import {
  createWalletClient,
  custom,
  recoverMessageAddress,
  type Account,
  type Chain,
  type Hex,
  type Transport,
  type TypedDataDefinition,
  type WalletClient,
} from 'viem';
import { base } from 'viem/chains';
import { stableOwnerSignature } from '@stage-labs/client/accounts/keys';
import { derivedSignature, privyLoginOf, privySignerKind, privyUnlockMessage } from '@stage-labs/client/accounts/privy';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import { reported } from './errorPolicy';
import { privyForget, privyProvider } from './privyBridge';
import type { Eip1193Provider, PrivySession } from './privy.types';
import { externalWalletProvider, forgetExternalWallet } from './externalWallet';
import { forgetPrivyUnlock, privyUnlockSignature } from './privyUnlock';

type PrivyWalletClient = WalletClient<Transport, Chain, Account>;

const CHAIN_NOT_ADDED = 4902;

function sessionOf(rec: AccountRecord): PrivySession {
  return { address: rec.address, method: privyLoginOf(rec) };
}

function providerFor(rec: AccountRecord): Promise<Eip1193Provider> {
  return privyLoginOf(rec) === 'wallet' ? externalWalletProvider(rec.address) : privyProvider(sessionOf(rec));
}

async function clientFor(rec: AccountRecord, chain: Chain): Promise<PrivyWalletClient> {
  const provider = await providerFor(rec);
  return createWalletClient({ account: rec.address as Hex, chain, transport: custom(provider) });
}

function errorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
}

async function ensureChain(client: PrivyWalletClient, chain: Chain): Promise<void> {
  if ((await client.getChainId()) === chain.id) return;
  try {
    await client.switchChain({ id: chain.id });
  } catch (err) {
    if (errorCode(err) !== CHAIN_NOT_ADDED) throw err;
    await client.addChain({ chain });
    await client.switchChain({ id: chain.id });
  }
}

export async function privyWalletClient(rec: AccountRecord, chain: Chain): Promise<PrivyWalletClient> {
  const client = await clientFor(rec, chain);
  await ensureChain(client, chain);
  return client;
}

export async function privySignMessage(rec: AccountRecord, message: string): Promise<Hex> {
  return (await clientFor(rec, base)).signMessage({ message });
}

function typedDataChain(typedData: TypedDataDefinition): Chain | undefined {
  const chainId = typedData.domain?.chainId;
  return chainId === undefined ? undefined : VIEM_CHAINS[Number(chainId)];
}

export async function privySignTypedData(rec: AccountRecord, typedData: TypedDataDefinition): Promise<Hex> {
  const chain = typedDataChain(typedData);
  const client = await clientFor(rec, chain ?? base);
  if (chain !== undefined) await ensureChain(client, chain);
  return client.signTypedData(typedData);
}

async function signUnlock(rec: AccountRecord): Promise<Hex> {
  const message = privyUnlockMessage(rec.address);
  const sign = (text: string): Promise<Hex> => privySignMessage(rec, text);
  const embedded = privySignerKind(privyLoginOf(rec)) === 'embedded';
  const signature = embedded ? await stableOwnerSignature(message, sign) : await sign(message);
  const signer = await recoverMessageAddress({ message, signature });
  if (signer.toLowerCase() !== rec.address.toLowerCase()) {
    throw new Error('This wallet did not sign as itself. Smart contract wallets cannot sign in to Stage yet.');
  }
  return signature;
}

export function unlockPrivyAccount(rec: AccountRecord): Promise<Hex> {
  return privyUnlockSignature(rec.id, () => signUnlock(rec));
}

export async function privySignStable(rec: AccountRecord, message: string): Promise<Hex> {
  return derivedSignature(await unlockPrivyAccount(rec), message);
}

export async function forgetPrivyAccount(rec: AccountRecord): Promise<void> {
  await forgetPrivyUnlock(rec.id);
  const forget = privyLoginOf(rec) === 'wallet' ? forgetExternalWallet(rec.address) : privyForget(sessionOf(rec));
  void forget.catch(reported('privy.forget'));
}
