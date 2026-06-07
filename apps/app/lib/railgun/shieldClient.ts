/** On-chain signing + broadcast for the RAILGUN shield flow, using the active
 *  account's IN-APP EOA key (NOT WalletConnect — the 0zk wallet is derived from
 *  this same key, so the shield must be signed by it).
 *
 *  SECURITY: the private key is loaded only to build a viem account/wallet client
 *  in-process; it is NEVER logged and never crosses the bridge channel. The
 *  shieldPrivateKey is keccak256(EOA signature of the SDK's fixed message). */
import '../cryptoShim';
import {
  createPublicClient, createWalletClient, http, keccak256,
  type Hex, type Chain, type PublicClient, type WalletClient, type PrivateKeyAccount,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { getActiveAccountId } from '../accounts';
import { getViemAccount } from '../accounts.keys';
import { RAILGUN_NETWORKS, type RailgunNetworkConfig } from './networks';
import { shieldPrivateKeyMessage } from '@metro-labs/railgun-mobile/bridge/shieldCalls';

const VIEM_CHAIN: Record<number, Chain> = { 1: mainnet, 11155111: sepolia };

export interface ShieldSigner {
  address: Hex;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: PrivateKeyAccount;
  chain: Chain;
}

/** Build a viem public + wallet client bound to the active account's EOA key on
 *  the given Railgun network. Throws a friendly error if the active account has
 *  no exportable key (e.g. WalletConnect). */
export async function getShieldSigner(cfg: RailgunNetworkConfig): Promise<ShieldSigner> {
  const id = await getActiveAccountId();
  if (!id) throw new Error('No active account');
  const account = await getViemAccount(id);
  if (!account) throw new Error('Private wallet needs an in-app key (not WalletConnect)');
  const chain = VIEM_CHAIN[cfg.chainId] ?? sepolia;
  const transport = http(cfg.rpcUrls[0]);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return { address: account.address, publicClient, walletClient, account, chain };
}

/** Derive the 32-byte shieldPrivateKey = keccak256(EOA signature of the SDK's
 *  fixed shield message). The SDK uses this deterministically to blind the
 *  shield note; it must come from the same EOA each time. */
export async function deriveShieldPrivateKey(signer: ShieldSigner): Promise<string> {
  const message = await shieldPrivateKeyMessage();
  const signature = await signer.walletClient.signMessage({ account: signer.account, message });
  return keccak256(signature as Hex);
}

/** Resolve the Railgun network config for a chainId (defaults to Sepolia). */
export function shieldNetForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}
