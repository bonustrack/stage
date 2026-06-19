/**
 * @file Re-exports the Wallet asset registry + network metadata (now in the Stage SDK @stage-labs/client) so existing app imports stay stable.
 */
export {
  ASSETS,
  MAINNET_NETWORK_LOGO,
  NETWORK_LOGO,
  NATIVE_TOKEN_SENTINEL,
  VIEM_CHAINS,
  type AssetRow,
} from '@stage-labs/client/wallet/assets';
