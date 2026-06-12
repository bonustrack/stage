/** Wallet asset registry + network metadata moved into the framework-agnostic
 *  Stage SDK (@stage-labs/client). Re-exported so existing app imports stay
 *  stable. */
export {
  ASSETS,
  MAINNET_NETWORK_LOGO,
  NETWORK_LOGO,
  NATIVE_TOKEN_SENTINEL,
  VIEM_CHAINS,
  type AssetRow,
} from '@stage-labs/client/wallet/assets';
