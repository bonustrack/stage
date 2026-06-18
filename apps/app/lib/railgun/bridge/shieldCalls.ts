/** RN-side SHIELD bridge wrappers - thin shims over the pure frame builders in
 *  @stage-labs/client/railgun. The builders are framework-agnostic (they take an
 *  injected dispatcher); here we bind them to THIS binary's native `sdk()`
 *  dispatcher so the existing call sites keep their no-dispatch signatures and no
 *  logic is duplicated. The wire protocol lives in the SDK; the native channel
 *  (nodejsMobile) stays here. */
import { sdk } from './sdk';
import {
  shieldPrivateKeyMessage as shieldPrivateKeyMessageSdk,
  ensureProviderLoaded as ensureProviderLoadedSdk,
  populateShieldBaseToken as populateShieldBaseTokenSdk,
  populateShieldErc20 as populateShieldErc20Sdk,
} from '@stage-labs/client/railgun';

/** The shield-private-key derivation message, signed by the EOA -> keccak -> key. */
export function shieldPrivateKeyMessage(): Promise<string> {
  return shieldPrivateKeyMessageSdk(sdk);
}

/** Load the RPC provider + register the merkletree before shielding (idempotent
 *  per chainId for the session; errors are NOT swallowed). */
export function ensureProviderLoaded(
  cfg: Parameters<typeof ensureProviderLoadedSdk>[1],
  networkName: string,
): Promise<void> {
  return ensureProviderLoadedSdk(sdk, cfg, networkName);
}

/** Populate a native-ETH (base-token) shield to the user's OWN 0zk. */
export function populateShieldBaseToken(
  params: Parameters<typeof populateShieldBaseTokenSdk>[1],
): ReturnType<typeof populateShieldBaseTokenSdk> {
  return populateShieldBaseTokenSdk(sdk, params);
}

/** Populate an ERC20 shield to the user's OWN 0zk (needs a prior approve). */
export function populateShieldErc20(
  params: Parameters<typeof populateShieldErc20Sdk>[1],
): ReturnType<typeof populateShieldErc20Sdk> {
  return populateShieldErc20Sdk(sdk, params);
}
