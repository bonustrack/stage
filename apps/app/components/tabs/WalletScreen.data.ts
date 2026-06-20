
import { fetchAssetRows as sdkFetchAssetRows } from '@stage-labs/client/wallet/balances';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

export async function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  return sdkFetchAssetRows(addr, { tokenLogo: stampTokenUrl });
}
