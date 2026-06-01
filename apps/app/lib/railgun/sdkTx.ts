/** Railgun private operations: shield, private transfer, unshield. Each runs the
 *  real SDK pipeline (estimate → [proof] → populate) and returns the populated
 *  `ContractTransaction` ready to broadcast. Shield + unshield go from the
 *  user's public EOA; private transfers use sendWithPublicWallet so the EOA pays
 *  gas in this first pass — public-broadcaster routing is a second-pass item,
 *  scaffolded via the sendWithPublicWallet flag + broadcaster-fee arg slots.
 *
 *  Refs (docs.railgun.org → developer-guide/wallet/transactions):
 *    Shielding   → getShieldPrivateKeySignatureMessage / gasEstimateForShield / populateShield
 *    Transfers   → gasEstimateForUnprovenTransfer / generateTransferProof / populateProvedTransfer
 *    Unshielding → gasEstimateForUnprovenUnshield / generateUnshieldProof / populateProvedUnshield */

import { keccak256, type Hex } from 'viem';
import type { ContractTransaction } from 'ethers';
import { TXIDVersion, type RailgunERC20AmountRecipient } from '@railgun-community/shared-models';
import { getActiveViemAccount } from '../accounts';
import { requireWalletApi } from './sdkApi';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';
import { buildGasDetails } from './sdkGas';
import type { RailgunWalletHandle } from './sdkWallet';

const TXID = TXIDVersion.V2_PoseidonMerkle;
const PUBLIC = true; // sendWithPublicWallet (EOA pays gas — first pass)

export interface TokenAmount { tokenAddress: string; amount: bigint }

/** Shield private key = keccak256 of the EOA's signature over RAILGUN_SHIELD. */
async function getShieldPrivateKey(): Promise<string> {
  const acct = await getActiveViemAccount();
  if (!acct) throw new Error('Active account cannot sign (needed to shield)');
  const message = requireWalletApi().getShieldPrivateKeySignatureMessage();
  return keccak256((await acct.signMessage({ message })) as Hex).slice(2);
}

function recipients(token: TokenAmount, to: string): RailgunERC20AmountRecipient[] {
  return [{ tokenAddress: token.tokenAddress, amount: token.amount, recipientAddress: to }];
}

/** Shield public ERC20 into the user's own 0zk address. */
export async function shield(
  net: RailgunNet, token: TokenAmount, toRailgunAddress: string,
): Promise<ContractTransaction> {
  const acct = await getActiveViemAccount();
  if (!acct) throw new Error('Active account cannot sign (needed to shield)');
  const sdk = requireWalletApi();
  const { networkName } = RAILGUN_NETWORKS[net];
  const key = await getShieldPrivateKey();
  const rs = recipients(token, toRailgunAddress);
  const { gasEstimate } = await sdk.gasEstimateForShield(TXID, networkName, key, rs, [], acct.address);
  const gasDetails = await buildGasDetails(networkName, gasEstimate);
  const { transaction } = await sdk.populateShield(TXID, networkName, key, rs, [], gasDetails);
  return transaction;
}

/** Private transfer of shielded ERC20 to another 0zk address. */
export async function privateTransfer(
  net: RailgunNet, wallet: RailgunWalletHandle, token: TokenAmount, to0zk: string,
): Promise<ContractTransaction> {
  const sdk = requireWalletApi();
  const { networkName } = RAILGUN_NETWORKS[net];
  const rs = recipients(token, to0zk);
  const original = await buildGasDetails(networkName, 0n);
  const { gasEstimate } = await sdk.gasEstimateForUnprovenTransfer(
    TXID, networkName, wallet.id, wallet.encryptionKey, undefined, rs, [], original, undefined, PUBLIC,
  );
  await sdk.generateTransferProof(
    TXID, networkName, wallet.id, wallet.encryptionKey,
    false, undefined, rs, [], undefined, PUBLIC, undefined, () => undefined,
  );
  const gasDetails = await buildGasDetails(networkName, gasEstimate);
  const { transaction } = await sdk.populateProvedTransfer(
    TXID, networkName, wallet.id, false, undefined, rs, [], undefined, PUBLIC, undefined, gasDetails,
  );
  return transaction;
}

/** Unshield shielded ERC20 back to a public EOA address. */
export async function unshield(
  net: RailgunNet, wallet: RailgunWalletHandle, token: TokenAmount, toEoa: string,
): Promise<ContractTransaction> {
  const sdk = requireWalletApi();
  const { networkName } = RAILGUN_NETWORKS[net];
  const rs = recipients(token, toEoa);
  const original = await buildGasDetails(networkName, 0n);
  const { gasEstimate } = await sdk.gasEstimateForUnprovenUnshield(
    TXID, networkName, wallet.id, wallet.encryptionKey, rs, [], original, undefined, PUBLIC,
  );
  await sdk.generateUnshieldProof(
    TXID, networkName, wallet.id, wallet.encryptionKey, rs, [], undefined, PUBLIC, undefined, () => undefined,
  );
  const gasDetails = await buildGasDetails(networkName, gasEstimate);
  const { transaction } = await sdk.populateProvedUnshield(
    TXID, networkName, wallet.id, rs, [], undefined, PUBLIC, undefined, gasDetails,
  );
  return transaction;
}
