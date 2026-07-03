import type { AssetRow } from './WalletScreen.assets';
import { buildSortedTokenRows as buildSorted, tokenRowId } from '@stage-labs/client/wallet/tokens';

export { tokenRowId };

export function buildSortedTokenRows(
  rows: AssetRow[],
  privateRows: AssetRow[],
): { r: AssetRow; id: string }[] {
  return buildSorted([...rows, ...privateRows]);
}
