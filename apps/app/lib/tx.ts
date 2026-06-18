/** Reusable on-chain send helper.
 *
 *  Builds an ERC-20 `transfer` / native send and broadcasts it through a viem
 *  wallet client keyed to the active account's in-app key. Takes human-readable
 *  inputs (decimal `amount` string, optional `token`) and returns the broadcast
 *  tx hash. Used by the wallet Send screen and chat-pay.
 *
 *  This path is for the legacy local-EOA records only (smart accounts execute
 *  through the ZeroDev Kernel client, not here). It throws a friendly error when
 *  the active account has no in-app key. */

import {
  isAddress, erc20Abi, encodeFunctionData,
  createWalletClient, type Hex,
} from 'viem';
import { getActiveViemAccount } from './accounts';
import { VIEM_CHAINS } from '../components/tabs/WalletScreen.assets';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { parseAmount } from './txAmount';

/** The per-chain RPC the rest of the wallet uses (balances multicall, on-chain
 *  reads). viem's stock chain definitions point `rpcUrls.default` at flaky
 *  public endpoints, so the in-app signing client must NOT use a bare `http()`
 *  default; route through brovider's multichain RPC keyed by chainId instead. */
const rpcTransport = broviderTransport;

/** A token to transfer. Omit (or pass `undefined`) to send the chain's native
 *  asset (ETH on mainnet). `decimals` defaults to 18 when not supplied. */
interface SendToken {
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
  /** Validate against the decimal-string form `parseUnits` actually consumes,
   *  so the guard and the signed value can never disagree (BUG3). */
  const value = parseAmount(amount, token ? token.decimals ?? 18 : 18);

  /** Sign + broadcast through a viem wallet client keyed to the active account's
   *  in-app key. */
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  /** Build the signing client with the same per-chain RPC the rest of the app
   *  uses (brovider), and pin the tx to `chain` so it targets the right network. */
  const client = createWalletClient({ account: local, chain, transport: rpcTransport(chainId) });
  if (token) {
    return client.sendTransaction({
      chain,
      to: token.address,
      data: encodeFunctionData({
        abi: erc20Abi, functionName: 'transfer', args: [to as Hex, value],
      }),
    });
  }
  return client.sendTransaction({ chain, to: to as Hex, value });
}

/** Broadcast a raw EIP-5792 call verbatim — `{to, data, value}` as carried by a
 *  payment request's `WalletSendCall`. Unlike `sendNativeOrToken` this does NOT
 *  build its own calldata: it forwards the request's `data` untouched, so an
 *  ERC-20 transfer request (to = token contract, data = `transfer(...)`,
 *  value = 0x0) actually moves the token instead of a native send. Signs from
 *  the active in-app account's local key. Returns the broadcast tx hash. */
export interface RawCall {
  to: string;
  data?: string;
  /** Hex wei. Defaults to 0. */
  value?: string;
  chainId?: number;
}

/** Send a raw transaction from the active in-app wallet, returning the tx hash. */
export async function sendCall(call: RawCall): Promise<Hex> {
  const { to, data, chainId = 1 } = call;
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  const value = BigInt(call.value ?? '0x0');

  const local = await getActiveViemAccount();
  if (!local) throw new Error('No in-app wallet to send from');
  const chain = VIEM_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  const client = createWalletClient({ account: local, chain, transport: rpcTransport(chainId) });
  return client.sendTransaction({
    chain, to: to as Hex, value, ...(data ? { data: data as Hex } : {}),
  });
}
