import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import {
  bn, wireGasDetails, wireRecipients,
  type RailgunErc20Recipient, type RailgunGasDetails,
} from './wire';
import type { PopulateResult } from './shieldCalls';

export type TransferGasDetails = RailgunGasDetails;

export type TransferErc20Recipient = RailgunErc20Recipient;

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
    wireRecipients(params.erc20Recipients),
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
    wireRecipients(params.erc20Recipients),
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
    wireRecipients(params.erc20Recipients),
    [],
    undefined,
    true,
    bn('0'),
    wireGasDetails(params.gasDetails),
  ]);
}
