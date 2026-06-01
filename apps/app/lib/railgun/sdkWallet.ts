/** Derive the Railgun (0zk) wallet from the user's EXISTING active account so
 *  the private wallet layers onto the identity used everywhere else (lib/
 *  accounts). The SDK keys a wallet off a BIP39 mnemonic + encryption key; our
 *  accounts store a raw secp256k1 private key, so we bridge deterministically:
 *
 *    privateKey --keccak256--> 32-byte digest
 *      --first 16 bytes as entropy--> ethers Mnemonic.fromEntropy --> 12 words
 *
 *  Same key in → same mnemonic → same 0zk address, no extra secret stored. The
 *  engine encryption key is keccak256(privateKey) (derived, not a password — a
 *  real password gate is a second-pass item).
 *
 *  Ref: docs.railgun.org → getting-started → "Create a RAILGUN Wallet"
 *  (createRailgunWallet(encryptionKey, mnemonic, creationBlockNumbers)). */

import '../cryptoShim';
import { keccak256, type Hex } from 'viem';
import { Mnemonic } from 'ethers';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { getActiveAccount } from '../accounts';
import { getPrivateKey } from '../accounts.keys';
import { requireWalletApi } from './sdkApi';
import { RAILGUN_NETWORKS } from './networks';

export interface RailgunWalletHandle {
  /** Engine wallet id (used by every tx/balance call). */
  id: string;
  /** The 0zk… private address to display + receive to. */
  railgunAddress: string;
  /** Engine encryption key (32-byte hex, no 0x) — needed for proofs/transfers. */
  encryptionKey: string;
}

let cached: RailgunWalletHandle | null = null;
let cachedForId: string | null = null;

function mnemonicFromPrivateKey(pk: Hex): string {
  const digest = keccak256(pk);
  const entropy = ('0x' + digest.slice(2, 34)) as Hex; // 16 bytes → 12 words
  return Mnemonic.fromEntropy(entropy).phrase;
}

/** Create-or-load the Railgun wallet for the CURRENT active account, memoized
 *  per account id. Throws when the account can't expose a key (WalletConnect),
 *  surfaced by the caller as an unsupported-account message. */
export async function deriveRailgunWallet(): Promise<RailgunWalletHandle> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (cached && cachedForId === acct.id) return cached;
  if (acct.type === 'walletconnect') {
    throw new Error('Private wallet needs an in-app key (not WalletConnect)');
  }
  const pk = await getPrivateKey(acct.id);
  if (!pk) throw new Error('Active account has no private key for Railgun');

  const mnemonic = mnemonicFromPrivateKey(pk);
  const encryptionKey = keccak256(pk).slice(2);

  const creationBlocks: Record<string, number> = {};
  for (const cfg of Object.values(RAILGUN_NETWORKS)) {
    creationBlocks[cfg.networkName] = NETWORK_CONFIG[cfg.networkName].deploymentBlock;
  }

  const sdk = requireWalletApi();
  const info = await sdk.createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
  cached = { id: info.id, railgunAddress: sdk.getRailgunAddress(info.id) ?? '', encryptionKey };
  cachedForId = acct.id;
  return cached;
}

/** Drop the memoized handle (e.g. after switching accounts). */
export function resetRailgunWallet(): void {
  cached = null;
  cachedForId = null;
}
