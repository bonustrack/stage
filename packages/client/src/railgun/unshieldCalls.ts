import type { RailgunDispatch } from './dispatch';
import { SDK_METHOD } from './methods';
import {
  bn, wireGasDetails, wireRecipients,
  type RailgunErc20Recipient, type RailgunGasDetails,
} from './wire';
import type { PopulateResult } from './shieldCalls';

export type UnshieldGasDetails = RailgunGasDetails;

export type UnshieldErc20Recipient = RailgunErc20Recipient;

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
    wireRecipients(params.erc20Recipients),
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
    wireRecipients(params.erc20Recipients),
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
    wireRecipients(params.erc20Recipients),
    [],
    undefined,
    true,
    bn('0'),
    wireGasDetails(params.gasDetails),
  ]);
}
