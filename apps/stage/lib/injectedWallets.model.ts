import type { Eip1193Provider } from './privy.types';

export interface InjectedWallet {
  rdns: string;
  name: string;
  icon: string;
  provider: Eip1193Provider;
}

const ICON = /^(data:image\/|https:\/\/)/i;
const LEGACY_RDNS = 'injected';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function providerOf(value: unknown): Eip1193Provider | null {
  const provider = record(value);
  return provider !== null && typeof provider.request === 'function' ? (value as Eip1193Provider) : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function iconOf(value: unknown): string {
  const icon = typeof value === 'string' ? value.trim() : '';
  return ICON.test(icon) ? icon : '';
}

export function walletFromAnnouncement(detail: unknown): InjectedWallet | null {
  const info = record(record(detail)?.info);
  const provider = providerOf(record(detail)?.provider);
  const rdns = nonEmpty(info?.rdns);
  const name = nonEmpty(info?.name);
  if (provider === null || rdns === null || name === null) return null;
  return { rdns, name, icon: iconOf(info?.icon), provider };
}

export function legacyWallet(ethereum: unknown): InjectedWallet | null {
  const provider = providerOf(ethereum);
  return provider === null ? null : { rdns: LEGACY_RDNS, name: 'Browser wallet', icon: '', provider };
}

export function withWallet(list: readonly InjectedWallet[], wallet: InjectedWallet): readonly InjectedWallet[] {
  const others = list.filter((known) => known.rdns !== wallet.rdns && known.rdns !== LEGACY_RDNS);
  return wallet.rdns === LEGACY_RDNS && others.length > 0 ? list : [...others, wallet];
}

export function addressesOf(accounts: unknown): string[] {
  return Array.isArray(accounts) ? accounts.filter((account): account is string => typeof account === 'string') : [];
}
