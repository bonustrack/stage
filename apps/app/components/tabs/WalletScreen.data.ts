/**
 * @file fetchAssetRows adapter — wallet token-balance fetch (multicall per chain +
 *  CoinGecko prices) wrapping the Stage SDK and injecting kit's stampTokenUrl logo helper.
 */

import { fetchAssetRows as sdkFetchAssetRows } from '@stage-labs/client/wallet/balances';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

/** Fetch every asset's on-chain balance + USD price for `addr` and return the ready-to-render AssetRow[]. */
export async function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  return sdkFetchAssetRows(addr, { tokenLogo: stampTokenUrl });
}
