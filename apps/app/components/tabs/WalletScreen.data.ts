/** Wallet token-balance fetch — multicall per chain + CoinGecko prices. The
 *  shaping logic moved into the framework-agnostic Stage SDK
 *  (@stage-labs/client); this thin adapter injects kit's stampTokenUrl (RN +
 *  web share the same shaping, only the logo-URL helper differs). */

import { fetchAssetRows as sdkFetchAssetRows } from '@stage-labs/client/wallet/balances';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

/** Fetch every asset's on-chain balance + USD price for `addr` and return the
 *  ready-to-render AssetRow[]. */
export async function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  return sdkFetchAssetRows(addr, { tokenLogo: stampTokenUrl });
}
