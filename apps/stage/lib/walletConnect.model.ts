import type { Eip1193Provider } from './privy.types';
import { SWITCH_CHAIN_METHOD, switchTargetOf } from './privyProvider.model';

export const WALLETCONNECT_CHAINS = [8453, 1, 11155111] as const;
export const WALLETCONNECT_METHODS = [
  'personal_sign',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  SWITCH_CHAIN_METHOD,
  'wallet_addEthereumChain',
] as const;
export const WALLETCONNECT_EVENTS = ['accountsChanged', 'chainChanged'] as const;

const CHAIN_NOT_ADDED = 4902;
const LOCAL_ANSWERS: ReadonlySet<string> = new Set(['eth_accounts', 'eth_requestAccounts']);

export function caipChain(chainId: number): string {
  return `eip155:${chainId}`;
}

export function sessionAddresses(accounts: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const account of accounts ?? []) {
    const [namespace, , address] = account.split(':');
    if (namespace === 'eip155' && address !== undefined) seen.add(address.toLowerCase());
  }
  return [...seen];
}

export function sessionChains(accounts: readonly string[] | undefined): number[] {
  const seen = new Set<number>();
  for (const account of accounts ?? []) {
    const [namespace, chain] = account.split(':');
    const id = Number(chain);
    if (namespace === 'eip155' && Number.isInteger(id)) seen.add(id);
  }
  return [...seen];
}

export interface WalletSessionRequest {
  address: string;
  chains: () => readonly number[];
  request: (args: { method: string; params?: unknown }, chain: string) => Promise<unknown>;
}

function chainNotAdded(): Error {
  return Object.assign(new Error('Your wallet did not approve that network.'), { code: CHAIN_NOT_ADDED });
}

export function sessionProvider(session: WalletSessionRequest): Eip1193Provider {
  let chainId = session.chains()[0] ?? WALLETCONNECT_CHAINS[0];
  return {
    request: async (args) => {
      if (args.method === 'eth_chainId') return `0x${chainId.toString(16)}`;
      if (LOCAL_ANSWERS.has(args.method)) return [session.address];
      if (args.method === SWITCH_CHAIN_METHOD) {
        const target = switchTargetOf(args.params);
        if (target === null || !session.chains().includes(target)) throw chainNotAdded();
        chainId = target;
        return null;
      }
      return session.request(args, caipChain(chainId));
    },
  };
}
