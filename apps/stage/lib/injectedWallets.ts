import type { InjectedWallet } from './injectedWallets.model';

const NONE: readonly InjectedWallet[] = [];

export function injectedWallets(): readonly InjectedWallet[] {
  return NONE;
}

export const subscribeInjectedWallets: (listener: () => void) => () => void = () => () => undefined;

export const findInjectedWallet: (rdns: string) => Promise<InjectedWallet | null> = () => Promise.resolve(null);
