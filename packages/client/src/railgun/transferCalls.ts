/** @file Typed, pure (no native imports) bridge frame builders for the RAILGUN private-to-private transfer primitives — gas.estimateTransfer → proof.transfer → tx.populateProvedTransfer — which require a Groth16 proof, fix sender-hiding + no-memo, wire-encode bigint amounts to survive the JSON channel, and self-broadcast (the host EOA signs the returned tx). */
import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';
import type { PopulateResult } from './shieldCalls';

/** EIP-1559 (Type2) gas details - both Ethereum + Sepolia default to Type2. Fees are decimal-string wei (wire-encoded to bigint in the host). */
export interface TransferGasDetails {
  /** EVMGasType enum value; 2 = Type2 (EIP-1559). */
  evmGasType: 0 | 1 | 2;
  gasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

/** One shielded ERC20 amount to transfer to a 0zk recipient. */
export interface TransferErc20Recipient {
  tokenAddress: string;
  /** Decimal-string wei amount. */
  amountWei: string;
  /** 0zk... recipient address. */
  recipientAddress: string;
}

/** Gas estimate for an unproven transfer. `sendWithPublicWallet` is `true` (self-broadcast, no broadcaster). Resolves the gasEstimate (decimal string). */
export async function gasEstimateTransfer(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: TransferErc20Recipient[];
  originalGasDetails: TransferGasDetails;
}): Promise<{ gasEstimate: string }> {
  return dispatch<{ gasEstimate: string }>(SDK_METHOD('gas.estimateTransfer'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    params.encryptionKey,
    undefined, /* memoText */
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /* nftAmountRecipients */
    wireGasDetails(params.originalGasDetails),
    undefined, /* feeTokenDetails (self-broadcast) */
    true, /* sendWithPublicWallet */
  ]);
}

/** Generate the Groth16 transfer proof (caches it in the host for the populate step). Resolves void; the heavy proving runs in the embedded prover. */
export async function generateTransferProof(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  encryptionKey: string;
  erc20Recipients: TransferErc20Recipient[];
}): Promise<void> {
  await dispatch(SDK_METHOD('proof.transfer'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    params.encryptionKey,
    false, /* showSenderAddressToRecipient */
    undefined, /* memoText */
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /* nftAmountRecipients */
    undefined, /* broadcasterFeeERC20AmountRecipient (self-broadcast) */
    true, /* sendWithPublicWallet */
    bn('0'), /* overallBatchMinGasPrice */
    /** progressCallback injected host-side (functions can't cross the channel) */
  ]);
}

/** Populate the proved transfer into a signable tx (uses the cached proof). */
export async function populateProvedTransfer(dispatch: RailgunDispatch, params: {
  txidVersion: string;
  networkName: string;
  railgunWalletID: string;
  erc20Recipients: TransferErc20Recipient[];
  gasDetails: TransferGasDetails;
}): Promise<PopulateResult> {
  return dispatch<PopulateResult>(SDK_METHOD('tx.populateProvedTransfer'), [
    params.txidVersion,
    params.networkName,
    params.railgunWalletID,
    false, /* showSenderAddressToRecipient */
    undefined, /* memoText */
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [], /* nftAmountRecipients */
    undefined, /* broadcasterFeeERC20AmountRecipient */
    true, /* sendWithPublicWallet */
    bn('0'), /* overallBatchMinGasPrice */
    wireGasDetails(params.gasDetails),
  ]);
}

/** Wire-encode the bigint fields of a TransferGasDetails for the channel. */
function wireGasDetails(g: TransferGasDetails): Record<string, unknown> {
  return {
    evmGasType: g.evmGasType,
    gasEstimate: bn(g.gasEstimate),
    maxFeePerGas: bn(g.maxFeePerGas),
    maxPriorityFeePerGas: bn(g.maxPriorityFeePerGas),
  };
}
