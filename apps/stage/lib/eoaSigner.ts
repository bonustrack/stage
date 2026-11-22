import { createWalletClient, type Account, type Chain, type Hex, type Transport, type TypedDataDefinition, type WalletClient } from 'viem';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { getActiveAccount, getViemAccount, type AccountRecord } from './accounts';
import { privySignMessage, privySignTypedData, privyWalletClient } from './privySigner';

export interface EoaSigner {
  address: Hex;
  signMessage: (args: { message: string }) => Promise<Hex>;
  signTypedData: (typedData: TypedDataDefinition) => Promise<Hex>;
  walletClient: (chain: Chain) => Promise<WalletClient<Transport, Chain, Account>>;
}

function privySigner(rec: AccountRecord): EoaSigner {
  return {
    address: rec.address as Hex,
    signMessage: ({ message }) => privySignMessage(rec, message),
    signTypedData: (typedData) => privySignTypedData(rec, typedData),
    walletClient: (chain) => privyWalletClient(rec, chain),
  };
}

export async function eoaSignerFor(rec: AccountRecord): Promise<EoaSigner | null> {
  if (rec.type === 'smart') return null;
  if (rec.type === 'privy') return privySigner(rec);
  const local = await getViemAccount(rec.id);
  if (!local) return null;
  return {
    address: local.address,
    signMessage: (args) => local.signMessage(args),
    signTypedData: (typedData) => local.signTypedData(typedData),
    walletClient: (chain) => Promise.resolve(createWalletClient({ account: local, chain, transport: broviderTransport(chain.id) })),
  };
}

export async function activeEoaSigner(): Promise<EoaSigner | null> {
  const rec = await getActiveAccount();
  return rec === null ? null : eoaSignerFor(rec);
}
