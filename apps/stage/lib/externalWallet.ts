import { getAddress } from 'viem';
import { shortAddress } from '@stage-labs/client/identity/format';
import { appStorage } from '../platform/storage';
import { ignored } from './errorPolicy';
import { addressesOf, type InjectedWallet } from './injectedWallets.model';
import { findInjectedWallet, injectedWallets } from './injectedWallets';
import { WALLETCONNECT_PROJECT_ID } from './privyConfig';
import type { Eip1193Provider } from './privy.types';
import { sameAddress } from './privyProvider.model';
import { SignInCancelled } from './signInCancelled';
import {
  chooseWallet,
  closeWalletPicker,
  showConnecting,
  whenPickerCancelled,
  type ConnectChoice,
  type WalletChoice,
} from './walletPicker';

const WALLETCONNECT = 'walletconnect';
const RECENT_KEY = 'wallet.recent';

interface Connected {
  address: string;
  connector: string;
}

function connectorKey(address: string): string {
  return `wallet.connector.${address.toLowerCase()}`;
}

async function accountsFrom(wallet: InjectedWallet, method: 'eth_accounts' | 'eth_requestAccounts'): Promise<string[]> {
  return addressesOf(await wallet.provider.request({ method }));
}

async function connectInjected(rdns: string): Promise<Connected> {
  const wallet = await findInjectedWallet(rdns);
  if (wallet === null) throw new Error('That wallet is no longer available. Try again.');
  showConnecting(wallet.name);
  const [address] = await accountsFrom(wallet, 'eth_requestAccounts');
  if (address === undefined) throw new Error(`${wallet.name} did not share an account.`);
  return { address: getAddress(address), connector: wallet.rdns };
}

async function connectChoice(choice: ConnectChoice): Promise<Connected> {
  if (choice.kind === 'injected') return connectInjected(choice.rdns);
  showConnecting(null);
  const { connectWalletConnect } = await import('./walletConnect');
  return { address: getAddress(await connectWalletConnect()), connector: WALLETCONNECT };
}

function directChoice(): ConnectChoice | null {
  return injectedWallets().length === 0 && WALLETCONNECT_PROJECT_ID !== undefined ? { kind: 'walletconnect' } : null;
}

async function finishConnect(choice: WalletChoice): Promise<string> {
  try {
    if (choice.kind === 'create' || choice.kind === 'import') throw new SignInCancelled();
    const work = connectChoice(choice);
    void work.catch(ignored(undefined, 'ui'));
    const connected = await Promise.race([work, whenPickerCancelled()]);
    await appStorage.set(connectorKey(connected.address), connected.connector);
    await appStorage.set(RECENT_KEY, connected.connector).catch(ignored(undefined, 'cache'));
    return connected.address;
  } finally {
    closeWalletPicker();
  }
}

async function recentConnector(): Promise<string | null> {
  return appStorage.get(RECENT_KEY).catch(ignored(null, 'cache'));
}

export async function connectExternalWallet(note: string | null = null): Promise<string> {
  const choice = await chooseWallet({ note, recent: await recentConnector(), only: directChoice(), account: false });
  return finishConnect(choice);
}

export type WalletSignIn = { kind: 'connected'; address: string } | { kind: 'create' } | { kind: 'import' };

export async function pickSignInWallet(): Promise<WalletSignIn> {
  const choice = await chooseWallet({ note: null, recent: await recentConnector(), only: null, account: true });
  if (choice.kind !== 'create' && choice.kind !== 'import') return { kind: 'connected', address: await finishConnect(choice) };
  closeWalletPicker();
  return { kind: choice.kind };
}

async function injectedFor(wallet: InjectedWallet, address: string): Promise<Eip1193Provider | null> {
  const has = (accounts: string[]): boolean => accounts.some((account) => sameAddress(account, address));
  if (has(await accountsFrom(wallet, 'eth_accounts'))) return wallet.provider;
  return has(await accountsFrom(wallet, 'eth_requestAccounts')) ? wallet.provider : null;
}

async function rememberedProvider(address: string): Promise<Eip1193Provider | null> {
  const connector = await appStorage.get(connectorKey(address));
  if (connector === WALLETCONNECT) return (await import('./walletConnect')).walletConnectProvider(address);
  const wallet = connector === null ? null : await findInjectedWallet(connector);
  return wallet === null ? null : injectedFor(wallet, address);
}

export async function externalWalletProvider(address: string): Promise<Eip1193Provider> {
  const remembered = await rememberedProvider(address);
  if (remembered !== null) return remembered;
  const short = shortAddress(address);
  const connected = await connectExternalWallet(`Connect ${short} to continue.`);
  if (!sameAddress(connected, address)) throw new Error(`Connect the wallet you signed in with (${short}).`);
  const provider = await rememberedProvider(address);
  if (provider === null) throw new Error(`Connect the wallet you signed in with (${short}).`);
  return provider;
}

async function revokeInjected(connector: string): Promise<void> {
  const wallet = await findInjectedWallet(connector);
  await wallet?.provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
}

export async function forgetExternalWallet(address: string): Promise<void> {
  const connector = await appStorage.get(connectorKey(address));
  await appStorage.delete(connectorKey(address));
  if (connector === WALLETCONNECT) await (await import('./walletConnect')).disconnectWalletConnect(address);
  else if (connector !== null) await revokeInjected(connector).catch(ignored(undefined, 'cleanup'));
}
