/** RN-side typed bridge wrappers for the RAILGUN SHIELD primitives.
 *
 *  Thin typed shells over the generic `sdk()` dispatcher: each composes one
 *  whitelisted @railgun-community/wallet call. bigint amounts are wire-encoded
 *  ({ __bigint }) so they survive the JSON channel and are revived to real
 *  bigints in the Node host before the SDK runs its commitment arithmetic.
 *
 *  Native ETH shields via the BASE-TOKEN path (populateShieldBaseToken — the
 *  contract wraps to WETH, tx carries `value`, no approve). ERC20 shields via
 *  populateShield (needs a prior approve to the proxy contract). We only ever
 *  populate (no broadcaster) — the EOA signs + broadcasts the returned tx on RN. */
import { sdk } from './sdk';
import { bn } from './wire';

/** The shield-private-key derivation message, signed by the EOA → keccak → key. */
export async function shieldPrivateKeyMessage(): Promise<string> {
  return sdk<string>('tx.getShieldPrivateKeySignatureMessage');
}

/** An ethers-style populated tx returned by populate*; bigints arrive as decimal
 *  strings (the host serialized them). `to`/`data`/`value` are what we sign. */
export interface PopulatedTx {
  to?: string;
  data?: string;
  value?: string;
  chainId?: string | number;
}
export interface PopulateResult {
  transaction: PopulatedTx;
}

/** Populate a native-ETH (base-token) shield: wraps to the network WETH and
 *  shields it to `railgunAddress` (the user's OWN 0zk). `amountWei` is decimal. */
export async function populateShieldBaseToken(params: {
  txidVersion: string;
  networkName: string;
  railgunAddress: string;
  shieldPrivateKey: string;
  wrappedTokenAddress: string;
  amountWei: string;
}): Promise<PopulateResult> {
  return sdk<PopulateResult>('tx.populateShieldBaseToken', [
    params.txidVersion,
    params.networkName,
    params.railgunAddress,
    params.shieldPrivateKey,
    { tokenAddress: params.wrappedTokenAddress, amount: bn(params.amountWei) },
  ]);
}

/** Populate an ERC20 shield to the user's OWN 0zk (`recipientAddress`). Requires
 *  a prior ERC20 approve of `amountWei` to the network proxy contract. */
export async function populateShieldErc20(params: {
  txidVersion: string;
  networkName: string;
  shieldPrivateKey: string;
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}): Promise<PopulateResult> {
  return sdk<PopulateResult>('tx.populateShield', [
    params.txidVersion,
    params.networkName,
    params.shieldPrivateKey,
    [{ tokenAddress: params.tokenAddress, amount: bn(params.amountWei), recipientAddress: params.recipientAddress }],
    [],
  ]);
}
