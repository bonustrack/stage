import '../cryptoShim';
import {
  createPublicClient, createWalletClient, http, keccak256,
  type Hex, type Chain, type PublicClient, type WalletClient, type PrivateKeyAccount,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { getActiveAccountId } from '../accounts';
import { getViemAccount } from '../zerodev/keyring';
import { RAILGUN_NETWORKS, type RailgunNetworkConfig } from './networks';
import { shieldPrivateKeyMessage } from './bridge/shieldCalls';

const VIEM_CHAIN: Record<number, Chain> = { 1: mainnet, 11155111: sepolia };

export interface ShieldSigner {
  address: Hex;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: PrivateKeyAccount;
  chain: Chain;
}

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

export async function deriveShieldPrivateKey(signer: ShieldSigner): Promise<string> {
  const message = await shieldPrivateKeyMessage();
  const signature = await signer.walletClient.signMessage({ account: signer.account, message });
  return keccak256(signature);
}

export function shieldNetForChainId(chainId: number): RailgunNetworkConfig {
  return chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
}
