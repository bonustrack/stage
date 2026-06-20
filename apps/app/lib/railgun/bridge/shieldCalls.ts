import { sdk } from './sdk';
import {
  shieldPrivateKeyMessage as shieldPrivateKeyMessageSdk,
  ensureProviderLoaded as ensureProviderLoadedSdk,
  populateShieldBaseToken as populateShieldBaseTokenSdk,
  populateShieldErc20 as populateShieldErc20Sdk,
} from '@stage-labs/client/railgun';

export function shieldPrivateKeyMessage(): Promise<string> {
  return shieldPrivateKeyMessageSdk(sdk);
}

export function ensureProviderLoaded(
  cfg: Parameters<typeof ensureProviderLoadedSdk>[1],
  networkName: string,
): Promise<void> {
  return ensureProviderLoadedSdk(sdk, cfg, networkName);
}

export function populateShieldBaseToken(
  params: Parameters<typeof populateShieldBaseTokenSdk>[1],
): ReturnType<typeof populateShieldBaseTokenSdk> {
  return populateShieldBaseTokenSdk(sdk, params);
}

export function populateShieldErc20(
  params: Parameters<typeof populateShieldErc20Sdk>[1],
): ReturnType<typeof populateShieldErc20Sdk> {
  return populateShieldErc20Sdk(sdk, params);
}
