import { ignored } from './errorPolicy';
import { legacyWallet, walletFromAnnouncement, withWallet, type InjectedWallet } from './injectedWallets.model';
import { makeWatched } from './watched';

const ANNOUNCE = 'eip6963:announceProvider';
const REQUEST = 'eip6963:requestProvider';
const LEGACY_WAIT_MS = 400;
const FIND_WAIT_MS = 1_000;

const wallets = makeWatched<readonly InjectedWallet[]>([]);
const listeners = new Set<() => void>();
let watching = false;

function publish(next: readonly InjectedWallet[]): void {
  wallets.set(next);
  for (const listener of [...listeners]) listener();
}

function announced(event: Event): void {
  const wallet = walletFromAnnouncement((event as CustomEvent<unknown>).detail);
  if (wallet !== null) publish(withWallet(wallets.get(), wallet));
}

function watchInjectedWallets(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener(ANNOUNCE, announced);
  window.dispatchEvent(new Event(REQUEST));
  setTimeout(() => {
    const legacy = legacyWallet((window as { ethereum?: unknown }).ethereum);
    if (legacy !== null) publish(withWallet(wallets.get(), legacy));
  }, LEGACY_WAIT_MS);
}

export function injectedWallets(): readonly InjectedWallet[] {
  watchInjectedWallets();
  return wallets.get();
}

export function subscribeInjectedWallets(listener: () => void): () => void {
  watchInjectedWallets();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function findInjectedWallet(rdns: string): Promise<InjectedWallet | null> {
  watchInjectedWallets();
  return wallets.until((list) => list.find((wallet) => wallet.rdns === rdns), FIND_WAIT_MS, 'not found').catch(ignored(null, 'probe'));
}
