/** Wallet asset registry + network metadata moved into the framework-agnostic
 *  Stage SDK (@metro-labs/client). Re-exported so existing app imports stay
 *  stable. */
export {
  MULTICALL3,
  ASSETS,
  MAINNET_NETWORK_LOGO,
  SEPOLIA_NETWORK_LOGO,
  NETWORK_LOGO,
  VIEM_CHAINS,
  erc20Abi,
  multicall3Abi,
  NATIVE_TOKEN_SENTINEL,
  type Asset,
  type AssetRow,
} from '@metro-labs/client/wallet/assets';
