
import '../cryptoShim';
import { getActiveAccount } from '../accounts';
import { requireWalletApi } from './sdkApi';
import { deriveRailgunKeyMaterial } from './deriveKeys';

export interface RailgunWalletHandle {
  id: string;
  railgunAddress: string;
  encryptionKey: string;
}

let cached: RailgunWalletHandle | null = null;
let cachedForId: string | null = null;

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
