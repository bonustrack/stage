import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import { bn } from './wire';
import type { PopulateResult } from './shieldCalls';

export interface TransferGasDetails {
  evmGasType: 0 | 1 | 2;
  gasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export interface TransferErc20Recipient {
  tokenAddress: string;
  amountWei: string;
  recipientAddress: string;
}

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
    undefined,
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [],
    wireGasDetails(params.originalGasDetails),
    undefined,
    true,
  ]);
}

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
    false,
    undefined,
    params.erc20Recipients.map(r => ({
      tokenAddress: r.tokenAddress, amount: bn(r.amountWei), recipientAddress: r.recipientAddress,
    })),
    [],
    undefined,
    true,
    bn('0'),
  ]);
}

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
    false,
    undefined,
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

function wireGasDetails(g: TransferGasDetails): Record<string, unknown> {
  return {
    evmGasType: g.evmGasType,
    gasEstimate: bn(g.gasEstimate),
    maxFeePerGas: bn(g.maxFeePerGas),
    maxPriorityFeePerGas: bn(g.maxPriorityFeePerGas),
  };
}
