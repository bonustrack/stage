import { privyMethodName } from '@stage-labs/client/accounts/privy';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { ignored, reported } from '../../lib/errorPolicy';
import type { PrivyOAuthProvider } from '../../lib/privyConfig';
import { arrayParamsProvider, isEmbeddedClient, sameAddress, switchingProvider } from '../../lib/privyProvider.model';
import type { Eip1193Provider, PrivyController, PrivyLoginPurpose, PrivySession } from '../../lib/privy.types';
import type { Watched } from '../../lib/watched';
import type { PrivyRuntimeHost } from './runtimeHost';

interface LinkedAccount {
  type: string;
  address?: string;
  chainType?: string;
  walletClientType?: string;
}

export interface WebPrivyUser {
  linkedAccounts: readonly LinkedAccount[];
}

export interface WebPrivyWallet {
  address: string;
  walletClientType: string;
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<{ request: (request: { method: string; params?: unknown[] }) => Promise<unknown> }>;
}

export type WebOAuthState = { status: 'initial' | 'loading' | 'done' } | { status: 'error'; error: Error | null };

export interface WebPrivyState {
  ready: boolean;
  authenticated: boolean;
  user: WebPrivyUser | null;
  wallets: readonly WebPrivyWallet[];
  walletsReady: boolean;
  oauth: WebOAuthState;
}

export interface WebPrivyActions {
  initOAuth: (provider: PrivyOAuthProvider) => Promise<void>;
  logout: () => Promise<void>;
  createWallet: () => Promise<unknown>;
}

export interface WebPrivyContext {
  state: Watched<WebPrivyState>;
  actions: () => WebPrivyActions;
  takeReturn: () => boolean;
  leave: () => Promise<never>;
  host: Pick<PrivyRuntimeHost, 'oauthProvider' | 'linkedType' | 'pending'>;
  reconnectMs?: number;
}

const READY_MS = 30_000;
const OAUTH_MS = 60_000;
const WALLET_MS = 30_000;
const RECONNECT_MS = 4_000;
const NOT_READY = 'Sign-in is not ready. Check your connection and try again.';

function isEmbedded(account: LinkedAccount): boolean {
  return account.type === 'wallet' && account.chainType === 'ethereum' && isEmbeddedClient(account.walletClientType);
}

function embeddedAddressOf(user: WebPrivyUser | null): string | null {
  return user?.linkedAccounts.find(isEmbedded)?.address ?? null;
}

function findWallet(state: WebPrivyState, address: string): WebPrivyWallet | undefined {
  return state.wallets.find((wallet) => sameAddress(wallet.address, address) && isEmbeddedClient(wallet.walletClientType));
}

function oauthSettled(state: WebPrivyState): boolean {
  if (state.oauth.status === 'error') throw state.oauth.error ?? new Error('Sign-in failed. Try again.');
  return state.authenticated && state.user !== null;
}

async function startOAuth(ctx: WebPrivyContext, method: PrivyLoginMethod, purpose: PrivyLoginPurpose): Promise<never> {
  if (ctx.state.get().authenticated) {
    await ctx.actions().logout();
    await ctx.state.until((state) => !state.authenticated, READY_MS, NOT_READY);
  }
  await ctx.host.pending.write(method, purpose);
  await ctx.actions().initOAuth(ctx.host.oauthProvider(method));
  return ctx.leave();
}

async function embeddedAddress(ctx: WebPrivyContext): Promise<string> {
  const known = embeddedAddressOf(ctx.state.get().user);
  if (known !== null) return known;
  await ctx.actions().createWallet().catch(reported('privy.createWallet'));
  return ctx.state.until((state) => embeddedAddressOf(state.user), WALLET_MS, 'Your wallet could not be created. Try again.');
}

async function socialLogin(ctx: WebPrivyContext, method: PrivyLoginMethod, purpose: PrivyLoginPurpose): Promise<PrivySession> {
  await ctx.state.until((state) => state.ready, READY_MS, NOT_READY);
  if (!ctx.takeReturn()) return startOAuth(ctx, method, purpose);
  try {
    await ctx.state.until(oauthSettled, OAUTH_MS, 'Sign-in took too long. Try again.');
  } finally {
    await ctx.host.pending.clear();
  }
  const linked = ctx.host.linkedType(method);
  if (ctx.state.get().user?.linkedAccounts.some((account) => account.type === linked) !== true) {
    throw new Error(`Sign-in with ${privyMethodName(method)} did not finish. Try again.`);
  }
  return { address: await embeddedAddress(ctx), method };
}

async function embeddedWallet(ctx: WebPrivyContext, account: PrivySession): Promise<WebPrivyWallet> {
  const owned = await ctx.state
    .until(
      (state) => state.authenticated && sameAddress(embeddedAddressOf(state.user), account.address),
      ctx.reconnectMs ?? RECONNECT_MS,
      '',
    )
    .catch(ignored(false, 'probe'));
  if (!owned) throw new Error(`Sign in with ${privyMethodName(account.method)} again to use this account. Open Settings, then Security.`);
  return ctx.state.until((state) => findWallet(state, account.address), WALLET_MS, 'Your wallet did not load. Try again.');
}

async function providerFor(ctx: WebPrivyContext, account: PrivySession): Promise<Eip1193Provider> {
  await ctx.state.until((state) => state.ready && state.walletsReady, READY_MS, NOT_READY);
  const wallet = await embeddedWallet(ctx, account);
  return switchingProvider({
    switchChain: (chainId) => wallet.switchChain(chainId),
    getProvider: async () => arrayParamsProvider(await wallet.getEthereumProvider()),
  });
}

async function forget(ctx: WebPrivyContext, account: PrivySession): Promise<void> {
  await ctx.state.until((state) => state.ready, READY_MS, NOT_READY);
  const state = ctx.state.get();
  if (state.authenticated && sameAddress(embeddedAddressOf(state.user), account.address)) await ctx.actions().logout();
}

export function makeWebPrivyController(ctx: WebPrivyContext): PrivyController {
  return {
    login: (method, purpose) => socialLogin(ctx, method, purpose),
    provider: (account) => providerFor(ctx, account),
    forget: (account) => forget(ctx, account),
  };
}
