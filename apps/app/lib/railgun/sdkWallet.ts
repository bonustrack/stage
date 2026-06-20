/** @file Direct-SDK path creating/loading the Railgun 0zk wallet from the active account's EOA key, deterministically bridging the raw key to a BIP39 mnemonic + keccak256-derived encryptionKey so the same key always yields the same 0zk address with no extra secret stored. */

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

/** Create-or-load the Railgun wallet for the current active account, memoized per account id; throws when the account can't expose a key, sharing key derivation with the embedded-Node bridge path so the 0zk address is identical either way. */
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
