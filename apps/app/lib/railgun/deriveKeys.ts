/** @file Single source of truth deterministically deriving RAILGUN key material (BIP39 mnemonic from keccak256(pk) entropy + a 32-byte encryption key) from the account's EOA private key so the 0zk address never drifts across launches or paths. */
import '../cryptoShim';
import { keccak256, type Hex } from 'viem';
import { Mnemonic } from 'ethers';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { getActiveAccount } from '../accounts';
import { railgunKeyMaterialFor } from '../zerodev/keyring';
import { RAILGUN_NETWORKS } from './networks';

export interface RailgunKeyMaterial {
  /** 12-word BIP39 mnemonic deterministically derived from the EOA key. */
  mnemonic: string;
  /** 32-byte engine encryption key, hex (no 0x). */
  encryptionKey: string;
  /** Per-network wallet creation blocks (deploymentBlock), keyed by NetworkName. */
  creationBlocks: Record<string, number>;
}

/** keccak256(pk) → first 16 bytes as entropy → 12-word mnemonic. */
export function mnemonicFromPrivateKey(pk: Hex): string {
  const digest = keccak256(pk);
  const entropy = ('0x' + digest.slice(2, 34)) as Hex; /* 16 bytes → 12 words */
  return Mnemonic.fromEntropy(entropy).phrase;
}

/** Engine encryption key = keccak256(pk) hex without the 0x prefix. */
export function encryptionKeyFromPrivateKey(pk: Hex): string {
  return keccak256(pk).slice(2);
}

/** Per-network deployment blocks, used as RAILGUN wallet creation blocks. */
function railgunCreationBlocks(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cfg of Object.values(RAILGUN_NETWORKS)) {
    out[cfg.networkName] = NETWORK_CONFIG[cfg.networkName].deploymentBlock;
  }
  return out;
}

/** Resolve the deterministic key material for the CURRENT active account. Throws a friendly error when the account can't expose a raw key (e.g. WalletConnect), surfaced by callers as an unsupported-account message. */
export async function deriveRailgunKeyMaterial(): Promise<RailgunKeyMaterial> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (acct.type === 'walletconnect') {
    throw new Error('Private wallet needs an in-app key (not WalletConnect)');
  }
  /** The raw key never leaves the keyring — it derives the material in place. */
  const material = await railgunKeyMaterialFor(acct.id);
  if (!material) throw new Error('Active account has no private key for Railgun');
  return { ...material, creationBlocks: railgunCreationBlocks() };
}
