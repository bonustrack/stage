/** Deterministic RAILGUN key material from the active account's EOA key.
 *
 *  WHY: the app's accounts store a raw secp256k1 private key, but the RAILGUN
 *  SDK keys a wallet off a BIP39 mnemonic + a 32-byte encryption key. We bridge
 *  the two DETERMINISTICALLY so the same EOA always yields the same 0zk address
 *  across launches (and across the direct-SDK path in sdkWallet.ts and the
 *  embedded-Node bridge path that actually inits the engine on-device):
 *
 *    privateKey --keccak256--> 32-byte digest
 *      --first 16 bytes as entropy--> ethers Mnemonic.fromEntropy --> 12 words
 *    encryptionKey = keccak256(privateKey) hex (no 0x)
 *
 *  No extra secret is stored; the EOA private key never leaves the RN side
 *  beyond the in-process bridge channel (see bridge/index.ts SECURITY note).
 *  This is the SINGLE source of truth for the derivation — both paths import it
 *  so the 0zk address can never drift between them. */
import '../cryptoShim';
import { keccak256, type Hex } from 'viem';
import { Mnemonic } from 'ethers';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { getActiveAccount } from '../accounts';
import { getPrivateKey } from '../accounts.keys';
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
  const entropy = ('0x' + digest.slice(2, 34)) as Hex; // 16 bytes → 12 words
  return Mnemonic.fromEntropy(entropy).phrase;
}

/** Engine encryption key = keccak256(pk) hex without the 0x prefix. */
export function encryptionKeyFromPrivateKey(pk: Hex): string {
  return keccak256(pk).slice(2);
}

/** Per-network deployment blocks, used as RAILGUN wallet creation blocks. */
export function railgunCreationBlocks(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cfg of Object.values(RAILGUN_NETWORKS)) {
    out[cfg.networkName] = NETWORK_CONFIG[cfg.networkName].deploymentBlock;
  }
  return out;
}

/** Resolve the deterministic key material for the CURRENT active account.
 *  Throws a friendly error when the account can't expose a raw key (e.g.
 *  WalletConnect), surfaced by callers as an unsupported-account message. */
export async function deriveRailgunKeyMaterial(): Promise<RailgunKeyMaterial> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (acct.type === 'walletconnect') {
    throw new Error('Private wallet needs an in-app key (not WalletConnect)');
  }
  const pk = await getPrivateKey(acct.id);
  if (!pk) throw new Error('Active account has no private key for Railgun');
  return {
    mnemonic: mnemonicFromPrivateKey(pk),
    encryptionKey: encryptionKeyFromPrivateKey(pk),
    creationBlocks: railgunCreationBlocks(),
  };
}
