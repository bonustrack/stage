import { tokenStampArgs } from '@stage-labs/client/wallet/tokens';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

export { isUnknownToken, priceKeyFor, priceKeyId, type PriceKey } from '@stage-labs/client/wallet/tokens';

export function tokenLogoUrl(
  chainId: number, token: string | null | undefined, displayPx: number,
): string {
  const { chainId: c, contract } = tokenStampArgs(chainId, token);
  return stampTokenUrl(c, contract, displayPx);
}
