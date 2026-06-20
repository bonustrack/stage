import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';

export async function shieldPrivateKeyMessage(dispatch: RailgunDispatch): Promise<string> {
  return dispatch<string>(SDK_METHOD('tx.getShieldPrivateKeySignatureMessage'));
}

export interface FallbackProviderConfig {
  chainId: number;
  providers: { provider: string; priority: number; weight: number }[];
}

const providerLoaded = new Set<number>();

export async function ensureProviderLoaded(
  dispatch: RailgunDispatch,
  cfg: FallbackProviderConfig,
  networkName: string,
): Promise<void> {
  if (providerLoaded.has(cfg.chainId)) return;
  try {
    await dispatch<boolean>(SDK_METHOD('engine.loadProvider'), [cfg, networkName, 1000 * 60 * 5]);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    throw new Error(`Couldn't connect to the ${networkName} RPC for shielding: ${msg}`);
  }
  providerLoaded.add(cfg.chainId);
}

export interface PopulatedTx {
  to?: string;
  data?: string;
  value?: string;
  chainId?: string | number;
}
export interface PopulateResult {
  transaction: PopulatedTx;
}

export async function populateShieldBaseToken(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunAddress: string;
  shieldPrivateKey: string;
  wrappedTokenAddress: string;
  amountWei: string;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateShieldBaseToken'), [
    params.txidVersion,
    params.networkName,
    params.railgunAddress,
    params.shieldPrivateKey,
    { tokenAddress: params.wrappedTokenAddress, amount: bn(params.amountWei) },
  ]);
}

export async function populateShieldErc20(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  shieldPrivateKey: string;
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateShield'), [
    params.txidVersion,
    params.networkName,
    params.shieldPrivateKey,
    [{ tokenAddress: params.tokenAddress, amount: bn(params.amountWei), recipientAddress: params.recipientAddress }],
    [],
  ]);
}
