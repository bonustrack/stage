/**
 * @file Typed bridge frame builders for the Railgun shield (public to private) primitives.
 */
/**
 * Typed bridge frame builders for the RAILGUN SHIELD primitives.
 *
 *  Thin typed shells over the injected generic `dispatch()` (RailgunDispatch):
 *  each composes one whitelisted @railgun-community/wallet call. bigint amounts
 *  are wire-encoded ({ __bigint }) so they survive the JSON channel and are
 *  revived to real bigints in the Node host before the SDK runs its commitment
 *  arithmetic.
 *
 *  Native ETH shields via the BASE-TOKEN path (populateShieldBaseToken - the
 *  contract wraps to WETH, tx carries `value`, no approve). ERC20 shields via
 *  populateShield (needs a prior approve to the proxy contract). We only ever
 *  populate (no broadcaster) - the EOA signs + broadcasts the returned tx on the
 *  host side.
 *
 *  PURE: no native imports. The dispatcher that ships these frames is injected.
 */
import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';

/** The shield-private-key derivation message, signed by the EOA -> keccak -> key. */
export async function shieldPrivateKeyMessage(dispatch: RailgunDispatch): Promise<string> {
  return dispatch<string>(SDK_METHOD('tx.getShieldPrivateKeySignatureMessage'));
}

/** Fallback-provider JSON config the engine's loadProvider expects: { chainId, providers:[{ provider:url, priority, weight }] }. */
export interface FallbackProviderConfig {
  chainId: number;
  providers: { provider: string; priority: number; weight: number }[];
}

/** Chains whose RPC provider has already been loaded into the embedded engine this session, so repeat shields don't reload (the SDK is idempotent, but a reload re-spins the polling provider - skip the round-trip). */
const providerLoaded = new Set<number>();

/**
 * Load the RPC provider + register the merkletree for `networkName` into the
 *  embedded engine, via the already-whitelisted `engine.loadProvider` dispatch.
 *
 *  WHY: the bridge `engineInit` attempts both networks' providers but swallows
 *  per-network RPC failures - so if the target chain's public RPC was rate-
 *  limited/down at boot, no merkletree is registered and a later `populateShield`
 *  fails with the cryptic "No value found for txidVersion=null and chain=0:<id>".
 *  We re-load it here, BEFORE shielding, and let any RPC/load error surface with
 *  a clear message instead of that null-merkletree error.
 *
 *  Idempotent per chainId for the session; errors are NOT swallowed.
 */
export async function ensureProviderLoaded(
  dispatch: RailgunDispatch,
  cfg: FallbackProviderConfig,
  networkName: string,
): Promise<void> {
  if (providerLoaded.has(cfg.chainId)) return;
  try {
    await dispatch<boolean>(SDK_METHOD('engine.loadProvider'), [cfg, networkName, 1000 * 60 * 5]);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    throw new Error(`Couldn't connect to the ${networkName} RPC for shielding: ${msg}`);
  }
  providerLoaded.add(cfg.chainId);
}

/** An ethers-style populated tx returned by populate*; bigints arrive as decimal strings (the host serialized them). `to`/`data`/`value` are what we sign. */
export interface PopulatedTx {
  to?: string;
  data?: string;
  value?: string;
  chainId?: string | number;
}
export interface PopulateResult {
  transaction: PopulatedTx;
}

/** Populate a native-ETH (base-token) shield: wraps to the network WETH and shields it to `railgunAddress` (the user's OWN 0zk). `amountWei` is decimal. */
export async function populateShieldBaseToken(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunAddress: string;
  shieldPrivateKey: string;
  wrappedTokenAddress: string;
  amountWei: string;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateShieldBaseToken'), [
    params.txidVersion,
    params.networkName,
    params.railgunAddress,
    params.shieldPrivateKey,
    { tokenAddress: params.wrappedTokenAddress, amount: bn(params.amountWei) },
  ]);
}

/** Populate an ERC20 shield to the user's OWN 0zk (`recipientAddress`). Requires a prior ERC20 approve of `amountWei` to the network proxy contract. */
export async function populateShieldErc20(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  shieldPrivateKey: string;
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateShield'), [
    params.txidVersion,
    params.networkName,
    params.shieldPrivateKey,
    [{ tokenAddress: params.tokenAddress, amount: bn(params.amountWei), recipientAddress: params.recipientAddress }],
    [],
  ]);
}
