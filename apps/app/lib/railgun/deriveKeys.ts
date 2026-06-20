import '../cryptoShim';
import { keccak256, type Hex } from 'viem';
import { Mnemonic } from 'ethers';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { getActiveAccount } from '../accounts';
import { railgunKeyMaterialFor } from '../zerodev/keyring';
import { RAILGUN_NETWORKS } from './networks';

export interface RailgunKeyMaterial {
  mnemonic: string;
  encryptionKey: string;
  creationBlocks: Record<string, number>;
}

export function mnemonicFromPrivateKey(pk: Hex): string {
  const digest = keccak256(pk);
  const entropy = ('0x' + digest.slice(2, 34)) as Hex;
  return Mnemonic.fromEntropy(entropy).phrase;
}

export function encryptionKeyFromPrivateKey(pk: Hex): string {
  return keccak256(pk).slice(2);
}

function railgunCreationBlocks(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cfg of Object.values(RAILGUN_NETWORKS)) {
    out[cfg.networkName] = NETWORK_CONFIG[cfg.networkName].deploymentBlock;
  }
  return out;
}

export async function deriveRailgunKeyMaterial(): Promise<RailgunKeyMaterial> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (acct.type === 'walletconnect') {
    throw new Error('Private wallet needs an in-app key (not WalletConnect)');
  }
  const material = await railgunKeyMaterialFor(acct.id);
  if (!material) throw new Error('Active account has no private key for Railgun');
  return { ...material, creationBlocks: railgunCreationBlocks() };
}
