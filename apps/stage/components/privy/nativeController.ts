import { privyMethodName } from '@stage-labs/client/accounts/privy';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { reported } from '../../lib/errorPolicy';
import type { PrivyOAuthProvider } from '../../lib/privyConfig';
import { arrayParamsProvider, isEmbeddedClient, sameAddress } from '../../lib/privyProvider.model';
import type { Eip1193Provider, PrivyController, PrivySession } from '../../lib/privy.types';
import type { Watched } from '../../lib/watched';
import { SignInCancelled } from '../../lib/signInCancelled';

interface LinkedAccount {
  type: string;
  address?: string;
  chain_type?: string;
  wallet_client_type?: string;
}

export interface NativePrivyUser {
  linked_accounts: readonly LinkedAccount[];
}

export interface NativeEmbeddedWallet {
  address: string;
  getProvider: () => Promise<{ request: (request: { method: string; params?: unknown[] }) => Promise<unknown> }>;
}

export interface NativePrivyState {
  ready: boolean;
  user: NativePrivyUser | null;
  wallets: readonly NativeEmbeddedWallet[];
}

export interface NativePrivyActions {
  oauth: (provider: PrivyOAuthProvider) => Promise<NativePrivyUser | undefined>;
  logout: () => Promise<void>;
  createWallet: () => Promise<unknown>;
}

export interface NativePrivyContext {
  state: Watched<NativePrivyState>;
  actions: () => NativePrivyActions;
  oauthProvider: (method: PrivyLoginMethod) => PrivyOAuthProvider;
  reconnectMs?: number;
}

const READY_MS = 30_000;
const WALLET_MS = 30_000;
const RECONNECT_MS = 4_000;
const NOT_READY = 'Sign-in is not ready. Check your connection and try again.';

function isEmbedded(account: LinkedAccount): boolean {
  return account.type === 'wallet' && account.chain_type === 'ethereum' && isEmbeddedClient(account.wallet_client_type);
}

function embeddedAddressOf(user: NativePrivyUser | null): string | null {
  return user?.linked_accounts.find(isEmbedded)?.address ?? null;
}

function loadedEmbedded(state: NativePrivyState): string | null {
  const address = embeddedAddressOf(state.user);
  return address !== null && state.wallets.some((wallet) => sameAddress(wallet.address, address)) ? address : null;
}

async function embeddedAddress(ctx: NativePrivyContext): Promise<string> {
  if (embeddedAddressOf(ctx.state.get().user) === null) await ctx.actions().createWallet().catch(reported('privy.createWallet'));
  return ctx.state.until(loadedEmbedded, WALLET_MS, 'Your wallet could not be created. Try again.');
}

async function socialLogin(ctx: NativePrivyContext, method: PrivyLoginMethod): Promise<PrivySession> {
  await ctx.state.until((state) => state.ready, READY_MS, NOT_READY);
  if (ctx.state.get().user !== null) {
    await ctx.actions().logout();
    await ctx.state.until((state) => state.user === null, READY_MS, NOT_READY);
  }
  const user = await ctx.actions().oauth(ctx.oauthProvider(method));
  if (user === undefined) throw new SignInCancelled();
  await ctx.state.until((state) => state.user !== null, READY_MS, NOT_READY);
  return { address: await embeddedAddress(ctx), method };
}

async function embeddedProvider(ctx: NativePrivyContext, account: PrivySession): Promise<Eip1193Provider> {
  const find = (state: NativePrivyState): NativeEmbeddedWallet | undefined =>
    state.wallets.find((wallet) => sameAddress(wallet.address, account.address));
  await ctx.state.until(
    (state) => sameAddress(embeddedAddressOf(state.user), account.address),
    ctx.reconnectMs ?? RECONNECT_MS,
    `Sign in with ${privyMethodName(account.method)} again to use this account. Open Settings, then Security.`,
  );
  const wallet = await ctx.state.until(find, WALLET_MS, 'Your wallet did not load. Try again.');
  return arrayParamsProvider(await wallet.getProvider());
}

async function providerFor(ctx: NativePrivyContext, account: PrivySession): Promise<Eip1193Provider> {
  await ctx.state.until((state) => state.ready, READY_MS, NOT_READY);
  return embeddedProvider(ctx, account);
}

async function forget(ctx: NativePrivyContext, account: PrivySession): Promise<void> {
  await ctx.state.until((state) => state.ready, READY_MS, NOT_READY);
  if (sameAddress(embeddedAddressOf(ctx.state.get().user), account.address)) await ctx.actions().logout();
}

export function makeNativePrivyController(ctx: NativePrivyContext): PrivyController {
  return {
    login: (method) => socialLogin(ctx, method),
    provider: (account) => providerFor(ctx, account),
    forget: (account) => forget(ctx, account),
  };
}
