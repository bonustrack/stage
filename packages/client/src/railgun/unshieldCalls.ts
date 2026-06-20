/** @file Typed bridge frame builders for the Railgun UNSHIELD (private->public) primitives — three whitelisted dispatcher calls (gas.estimateUnshield -> proof.unshield -> tx.populateProvedUnshield) that always self-broadcast (sendWithPublicWallet true) with wire-encoded bigint amounts; pure, the dispatcher is injected. */
import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';
import type { PopulateResult } from './shieldCalls';

/** EIP-1559 (Type2) gas details - both Ethereum + Sepolia default to Type2. Fees are decimal-string wei (wire-encoded to bigint in the host). */
export interface UnshieldGasDetails {
  /** EVMGasType enum value; 2 = Type2 (EIP-1559). */
  evmGasType: 0 | 1 | 2;
  gasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

/** One shielded ERC20 amount to unshield to a public recipient. */
export interface UnshieldErc20Recipient {
  tokenAddress: string;
  /** Decimal-string wei amount. */
  amountWei: string;
  /** Public recipient (the user's own EOA by default). */
  recipientAddress: string;
}

/** Gas estimate for an unproven unshield. `sendWithPublicWallet` is `true` (self-broadcast, no broadcaster). Resolves the gasEstimate (decimal string). */
export async function gasEstimateUnshield(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: UnshieldErc20Recipient[];
  originalGasDetails: UnshieldGasDetails;
}): Promise<{ gasEstimate: string }> {
  return dispatch<{ gasEstimate: string }>(SDK_METHOD('gas.estimateUnshield'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    params.encryptionKey,
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /** nftAmountRecipients */
    wireGasDetails(params.originalGasDetails),
    undefined, /** feeTokenDetails (self-broadcast) */
    true, /** sendWithPublicWallet */
  ]);
}

/** Generate the Groth16 unshield proof (caches it in the host for the populate step). Resolves void; the heavy proving runs in the embedded prover. */
export async function generateUnshieldProof(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: UnshieldErc20Recipient[];
}): Promise<void> {
  await dispatch(SDK_METHOD('proof.unshield'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    params.encryptionKey,
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /** nftAmountRecipients */
    undefined, /** broadcasterFeeERC20AmountRecipient (self-broadcast) */
    true, /** sendWithPublicWallet */
    bn('0'), /** overallBatchMinGasPrice; progressCallback injected host-side (functions can't cross the channel) */
  ]);
}

/** Populate the proved unshield into a signable tx (uses the cached proof). */
export async function populateProvedUnshield(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  erc20Recipients: UnshieldErc20Recipient[];
  gasDetails: UnshieldGasDetails;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateProvedUnshield'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /** nftAmountRecipients */
    undefined, /** broadcasterFeeERC20AmountRecipient */
    true, /** sendWithPublicWallet */
    bn('0'), /** overallBatchMinGasPrice */
    wireGasDetails(params.gasDetails),
  ]);
}

/** Wire-encode the bigint fields of an UnshieldGasDetails for the channel. */
function wireGasDetails(g: UnshieldGasDetails): Record<string, unknown> {
  return {
    evmGasType: g.evmGasType,
    gasEstimate: bn(g.gasEstimate),
    maxFeePerGas: bn(g.maxFeePerGas),
    maxPriorityFeePerGas: bn(g.maxPriorityFeePerGas),
  };
}
