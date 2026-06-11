/** Reusable on-chain send helper.
 *
 *  Wraps wagmi's `sendTransaction` (native ETH) and `writeContract` (ERC-20
 *  `transfer`) behind a single `sendNativeOrToken()` that takes human-readable
 *  inputs (decimal `amount` string, optional `token`) and returns the broadcast
 *  tx hash. The connected wallet comes from the Reown AppKit / wagmi session in
 *  lib/walletconnect.ts; this helper makes no UI calls so it can be reused by
 *  the wallet Send screen and (phase 4) chat-pay.
 *
 *  The signing wallet must already be connected via `useAppKit().open()` —
 *  `sendNativeOrToken` throws a friendly error if no account is connected, and
 *  transparently switches the wallet to `chainId` when it's on the wrong chain. */

import { getAccount, sendTransaction, writeContract, switchChain } from 'wagmi/actions';
import {
  isAddress, parseUnits, erc20Abi, encodeFunctionData,
  createWalletClient, http, type Hex,
} from 'viem';
import { wagmiConfig } from './walletconnect';
import { getActiveViemAccount } from './accounts';
import { VIEM_CHAINS } from '../components/tabs/WalletScreen.assets';

/** A token to transfer. Omit (or pass `undefined`) to send the chain's native
 *  asset (ETH on mainnet). `decimals` defaults to 18 when not supplied. */
export interface SendToken {
  address: Hex;
  decimals?: number;
  symbol?: string;
}

export interface SendParams {
  /** Recipient — must be a checksummed/lowercase 0x address (resolve ENS first). */
  to: string;
  /** Human-readable amount in whole token units, e.g. "0.05". */
  amount: string;
  /** ERC-20 to transfer; omit for the native asset. */
  token?: SendToken;
  /** Target chain. Defaults to mainnet (1). */
  chainId?: number;
}

/** Broadcast a native or ERC-20 transfer from the connected wallet.
 *  Returns the transaction hash once the wallet has signed + broadcast it
 *  (this resolves on broadcast, NOT on confirmation — callers that need a
 *  receipt should `waitForTransactionReceipt` separately). */
export async function sendNativeOrToken(params: SendParams): Promise<Hex> {
  const { to, amount, token, chainId = 1 } = params;

  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) throw new Error('Invalid amount');

  /** Prefer the app's OWN in-app wallet: when the active account is a local EOA
   *  (generated/imported/migrated) we sign + broadcast through a viem wallet
   *  client keyed to that account, no WalletConnect session required. This is
   *  the common case — the app always ships a built-in wallet. We only fall back
   *  to the wagmi/Reown path when the active account is a WalletConnect address
   *  (no local key). */
  const local = await getActiveViemAccount();
  if (local) {
    const chain = VIEM_CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain ${chainId}`);
    const client = createWalletClient({ account: local, chain, transport: http() });
    if (token) {
      const value = parseUnits(amount, token.decimals ?? 18);
      return client.sendTransaction({
        to: token.address,
        data: encodeFunctionData({
          abi: erc20Abi, functionName: 'transfer', args: [to as Hex, value],
        }),
      });
    }
    return client.sendTransaction({ to: to as Hex, value: parseUnits(amount, 18) });
  }

  const account = getAccount(wagmiConfig);
  if (!account.address) throw new Error('No wallet connected');

  /** Make sure the wallet is on the chain we're spending on. `switchChain`
   *  is a no-op (resolves immediately) when already on `chainId`. */
  if (account.chainId !== chainId) {
    await switchChain(wagmiConfig, { chainId });
  }

  if (token) {
    const value = parseUnits(amount, token.decimals ?? 18);
    return writeContract(wagmiConfig, {
      chainId,
      address: token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to as Hex, value],
    });
  }

  const value = parseUnits(amount, 18);
  return sendTransaction(wagmiConfig, { chainId, to: to as Hex, value });
}

/** Broadcast a raw EIP-5792 call verbatim — `{to, data, value}` as carried by a
 *  payment request's `WalletSendCall`. Unlike `sendNativeOrToken` this does NOT
 *  build its own calldata: it forwards the request's `data` untouched, so an
 *  ERC-20 transfer request (to = token contract, data = `transfer(...)`,
 *  value = 0x0) actually moves the token instead of a native send. Signs from
 *  the active in-app account when local; falls back to the WalletConnect
 *  session otherwise. Returns the broadcast tx hash. */
export interface RawCall {
  to: string;
  data?: string;
  /** Hex wei. Defaults to 0. */
  value?: string;
  chainId?: number;
}

export async function sendCall(call: RawCall): Promise<Hex> {
  const { to, data, chainId = 1 } = call;
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = BigInt(call.value ?? '0x0');

  const local = await getActiveViemAccount();
  if (local) {
    const chain = VIEM_CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain ${chainId}`);
    const client = createWalletClient({ account: local, chain, transport: http() });
    return client.sendTransaction({
      to: to as Hex, value, ...(data ? { data: data as Hex } : {}),
    });
  }

  const account = getAccount(wagmiConfig);
  if (!account.address) throw new Error('No wallet connected');
  if (account.chainId !== chainId) await switchChain(wagmiConfig, { chainId });
  return sendTransaction(wagmiConfig, {
    chainId, to: to as Hex, value, ...(data ? { data: data as Hex } : {}),
  });
}
