/** Guardian social recovery for the ZeroDev smart account (phase 2).
 *
 *  ZeroDev-native, NO Rhinestone, NO backend / signature-storage service. The
 *  flow (spec §(d) + review items 2 & 3):
 *    1. The owner installs a weighted-ECDSA GUARDIAN validator + the recovery
 *       ACTION on the Kernel (guardians = weight 1 each, threshold = M, native
 *       on-chain `delay` timelock).
 *    2. On a lost device the user re-derives / generates a NEW owner and sends a
 *       recovery REQUEST to the guardians over XMTP (./recovery.comms).
 *    3. Each guardian signs the rotation OFFCHAIN (EIP-712 Approve over the
 *       rotation's callDataAndNonceHash — gasless, no ETH) and posts the signature
 *       back into the recovery conversation.
 *    4. The initiator concatenates the guardian signatures into ONE sponsored
 *       doRecovery userOp. The on-chain `delay` opens a timelock window.
 *    5. TIMELOCK: the rotation does not take effect until the window elapses. The
 *       owner gets an XMTP push and can CANCEL with their passkey/owner key via
 *       the validator's native `veto`. After the window with no veto, the new
 *       owner is the `sudo` validator and the wallet is restored at the SAME
 *       address (the XMTP inbox survives — stable SCW address).
 *
 *  TIMELOCK = NATIVE: the WeightedECDSAValidator carries a uint48 `_delay` in its
 *  enable data and enforces validAfter on-chain; `veto` is the native owner-cancel
 *  primitive. We do NOT add a JS guard — we read/drive the native module. The
 *  PendingRotation record (@stage-labs/client/zerodev/recovery) is only a UI
 *  mirror of the on-chain `proposalStatus`.
 *
 *  REGULAR-SLOT CAVEAT (spec §(h)/(y) item 2): the guardian validator + recovery
 *  action occupy the Kernel's recovery action selector (doRecovery), installed via
 *  getRecoveryAction. The later agent session-key permission validator wants its
 *  OWN action/permissionId (Kernel v3.1 supports per-permissionId validators), so
 *  installing recovery against the dedicated recovery selector here does NOT
 *  preclude session keys. Full guardian + agent + passkey coexistence is UNVERIFIED
 *  without on-device testing — see the phase-3 TODO at the bottom. */

import '../cryptoShim';
import { encodeFunctionData, keccak256, encodeAbiParameters, parseAbiParameters, type Address, type Hex, type PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { createWeightedECDSAValidator, getRecoveryAction, getUpdateConfigCall } from '@zerodev/weighted-ecdsa-validator';
import { getValidatorAddress as getEcdsaValidatorAddress, signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getValidatorAddress as getWeightedValidatorAddress } from '@zerodev/weighted-ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import {
  weightedConfigFor, type WeightedConfig, DEFAULT_RECOVERY_DELAY_SECONDS,
} from '@stage-labs/client/zerodev/recovery';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel } from './account';

/** The doRecovery action ABI (the recovery-action contract entrypoint, §(d)). */
const DO_RECOVERY_ABI = [{
  type: 'function',
  name: 'doRecovery',
  stateMutability: 'nonpayable',
  inputs: [
    { name: '_validator', type: 'address' },
    { name: '_data', type: 'bytes' },
  ],
  outputs: [],
}] as const;

/** Minimal WeightedECDSAValidator fragments the SDK does not expose helpers for
 *  (owner-cancel + pending-state reads). veto = native owner-cancel; proposalStatus
 *  = the on-chain pending state we mirror into PendingRotation. */
const WEIGHTED_ABI = [
  { type: 'function', name: 'veto', stateMutability: 'nonpayable', inputs: [{ name: '_callDataAndNonceHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'proposalStatus', stateMutability: 'view', inputs: [{ name: 'callDataAndNonceHash', type: 'bytes32' }, { name: 'kernel', type: 'address' }], outputs: [{ name: 'status', type: 'uint8' }, { name: 'validAfter', type: 'uint48' }] },
] as const;

/** The recovery callData = a single doRecovery call rotating the ECDSA `sudo`
 *  validator to `newOwner`. The validator's enable data for an ECDSA owner is
 *  simply the 20-byte owner address. Both the install and the approval sign over
 *  the keccak of (sender, callData, nonce); see callDataAndNonceHash below. */
export function recoveryCallData(newOwner: Address): Hex {
  return encodeFunctionData({
    abi: DO_RECOVERY_ABI,
    functionName: 'doRecovery',
    args: [getEcdsaValidatorAddress(ENTRY_POINT, KERNEL_VERSION), newOwner],
  });
}

/** The hash guardians sign offchain (EIP-712 Approve domain handled by the
 *  validator's signUserOperation). keccak256(abi.encode(sender, callData, nonce))
 *  — matches the validator's internal callDataAndNonceHash so a recomputed pending
 *  proposal can be looked up via proposalStatus / vetoed. */
export function callDataAndNonceHash(sender: Address, callData: Hex, nonce: bigint): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters('address, bytes, uint256'), [sender, callData, nonce]));
}

/** Build the guardian weighted validator from a config. Reused by install +
 *  doRecovery (the validator's signUserOperation concatenates guardian sigs). */
async function buildGuardianValidator(publicClient: PublicClient, cfg: WeightedConfig, signers: { address: Address }[] = []) {
  return createWeightedECDSAValidator(publicClient, {
    config: { threshold: cfg.threshold, signers: cfg.signers.map(s => ({ address: s.address as Address, weight: s.weight })), delay: cfg.delay },
    // `signers` = the live Signer objects collecting offchain approvals; for the
    // install (owner-side) we pass none (config-only enable), for doRecovery the
    // initiator passes the guardian signers.
    signers: signers as never,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
}

/** INSTALL recovery: add the guardian weighted validator + recovery action onto
 *  the owner's Kernel via one sponsored userOp. The owner (current sudo) signs.
 *  Persists guardians + threshold on the record (display only). Native `delay` =
 *  the timelock window. */
export async function installGuardians(
  rec: AccountRecord,
  guardians: string[],
  threshold: number,
  delaySeconds: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const cfg = weightedConfigFor(guardians, threshold, delaySeconds);

  const owner = await smartOwnerSigner(rec.hdIndex);
  const publicClient = makePublicClient();

  // Owner Kernel (current sudo) + the guardian validator/action installed as the
  // recovery plugin. The recovery action is keyed to the dedicated doRecovery
  // selector (getRecoveryAction), leaving the generic `regular` slot free for a
  // future session-key permission validator (see caveat at top).
  const guardianValidator = await buildGuardianValidator(publicClient, cfg);
  const ownerValidator = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION });
  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: ownerValidator, regular: guardianValidator, action: getRecoveryAction(ENTRY_POINT.version) },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(rec.hdIndex),
  });
  const kernelClient = makeKernelClient(account, publicClient);

  // A no-op self-call userOp materializes the plugin install (enable data is
  // carried in the userOp's validator enable, sponsored by the paymaster).
  const hash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{ to: account.address, value: 0n, data: '0x' }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash });

  await updateSmartAccount(rec.id, {
    deployed: true,
    guardians: cfg.signers.map(s => s.address),
    guardianThreshold: cfg.threshold,
    guardianDelay: cfg.delay,
  });
  return hash;
}

/** GUARDIAN side: sign the rotation OFFCHAIN (gasless). Produces the EIP-712
 *  Approve signature over the recovery callDataAndNonceHash for the target wallet
 *  + newOwner, posted back into the recovery conversation (./recovery.comms).
 *  The guardian's signer is their own derived owner (their smart account's HD
 *  owner) — they spend no ETH; the signature is concatenated by the initiator. */
export async function signRecoveryApproval(
  guardianSigner: HDAccount,
  wallet: Address,
  newOwner: Address,
  nonce: bigint,
): Promise<Hex> {
  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(wallet, callData, nonce);
  const validatorAddress = getWeightedValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  // Same EIP-712 domain the validator's signUserOperation uses (version 0.0.3).
  return guardianSigner.signTypedData({
    domain: { name: 'WeightedECDSAValidator', version: '0.0.3', chainId: 8453, verifyingContract: validatorAddress },
    types: { Approve: [{ name: 'callDataAndNonceHash', type: 'bytes32' }] },
    primaryType: 'Approve',
    message: { callDataAndNonceHash: hash },
  });
}

/** OWNER CANCEL (native veto): during the timelock window the owner cancels a
 *  pending rotation with their passkey/owner key. One sponsored userOp calling
 *  the validator's `veto`. The owner's current Kernel client signs it. */
export async function cancelRecovery(rec: AccountRecord, newOwner: Address, nonce: bigint): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const owner = await smartOwnerSigner(rec.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account, publicClient);

  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(account.address, callData, nonce);
  const validatorAddress = getWeightedValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{
      to: validatorAddress, value: 0n,
      data: encodeFunctionData({ abi: WEIGHTED_ABI, functionName: 'veto', args: [hash] }),
    }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  return userOpHash;
}

/** RECONFIGURE guardians/threshold/delay (owner, native renew via the SDK helper).
 *  One sponsored userOp; the owner's current Kernel client signs it. Used by the
 *  guardian-setup screen to add/remove guardians or change M after install. */
export async function updateGuardians(
  rec: AccountRecord,
  guardians: string[],
  threshold: number,
  delaySeconds: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const cfg = weightedConfigFor(guardians, threshold, delaySeconds);
  const owner = await smartOwnerSigner(rec.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account, publicClient);

  const call = getUpdateConfigCall(ENTRY_POINT, KERNEL_VERSION, {
    threshold: cfg.threshold,
    signers: cfg.signers.map(s => ({ address: s.address as Address, weight: s.weight })),
    delay: cfg.delay,
  });
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{ to: call.to, value: call.value, data: call.data }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  await updateSmartAccount(rec.id, {
    guardians: cfg.signers.map(s => s.address),
    guardianThreshold: cfg.threshold,
    guardianDelay: cfg.delay,
  });
  return userOpHash;
}

