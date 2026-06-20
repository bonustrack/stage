import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';
import type { PopulateResult } from './shieldCalls';

export interface UnshieldGasDetails {
  evmGasType: 0 | 1 | 2;
  gasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export interface UnshieldErc20Recipient {
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}

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
    [],
    wireGasDetails(params.originalGasDetails),
    undefined,
    true,
  ]);
}

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
    [],
    undefined,
    true,
    bn('0'),
  ]);
}

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
    [],
    undefined,
    true,
    bn('0'),
    wireGasDetails(params.gasDetails),
  ]);
}

function wireGasDetails(g: UnshieldGasDetails): Record<string, unknown> {
  return {
    evmGasType: g.evmGasType,
    gasEstimate: bn(g.gasEstimate),
    maxFeePerGas: bn(g.maxFeePerGas),
    maxPriorityFeePerGas: bn(g.maxPriorityFeePerGas),
  };
}
