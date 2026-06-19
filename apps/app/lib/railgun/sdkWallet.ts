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
import { getActiveAccount } from '../accounts';
import { requireWalletApi } from './sdkApi';
import { deriveRailgunKeyMaterial } from './deriveKeys';

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

/** Create-or-load the Railgun wallet for the CURRENT active account, memoized
 *  per account id. Throws when the account can't expose a key (WalletConnect),
 *  surfaced by the caller as an unsupported-account message. Key derivation is
 *  shared with the embedded-Node bridge path (deriveKeys.ts) so the 0zk address
 *  is identical no matter which path created the wallet. */
export async function deriveRailgunWallet(): Promise<RailgunWalletHandle> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (cached && cachedForId === acct.id) return cached;

  const { mnemonic, encryptionKey, creationBlocks } = await deriveRailgunKeyMaterial();

  const sdk = requireWalletApi();
  const info = await sdk.createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
  const addr: unknown = sdk.getRailgunAddress(info.id);
  const railgunAddress = typeof addr === 'string' ? addr : '';
  cached = { id: info.id, railgunAddress, encryptionKey };
  cachedForId = acct.id;
  return cached;
}
