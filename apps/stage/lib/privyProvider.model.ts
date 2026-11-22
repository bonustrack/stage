import type { Eip1193Provider } from './privy.types';

export const SWITCH_CHAIN_METHOD = 'wallet_switchEthereumChain';

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isEmbeddedClient(walletClientType: string | undefined): boolean {
  return walletClientType === 'privy' || walletClientType === 'privy-v2';
}

export function switchTargetOf(params: unknown): number | null {
  const first: unknown = Array.isArray(params) ? params[0] : null;
  const chainId: unknown = typeof first === 'object' && first !== null && 'chainId' in first ? first.chainId : null;
  if (typeof chainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chainId)) return null;
  return Number.parseInt(chainId, 16);
}

interface ArrayParamsProvider {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export function arrayParamsProvider(provider: ArrayParamsProvider): Eip1193Provider {
  return {
    request: ({ method, params }) => provider.request(Array.isArray(params) ? { method, params: params as unknown[] } : { method }),
  };
}

export interface SwitchableWallet {
  switchChain: (chainId: number) => Promise<void>;
  getProvider: () => Promise<Eip1193Provider>;
}

export function switchingProvider(wallet: SwitchableWallet): Eip1193Provider {
  let inner: Promise<Eip1193Provider> | null = null;
  return {
    request: async (args) => {
      if (args.method === SWITCH_CHAIN_METHOD) {
        const target = switchTargetOf(args.params);
        if (target === null) throw new Error('The network to switch to is not valid.');
        await wallet.switchChain(target);
        inner = null;
        return null;
      }
      inner ??= wallet.getProvider();
      return (await inner).request(args);
    },
  };
}
