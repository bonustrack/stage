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
import { createKernelAccount, type KernelAccountClient } from '@zerodev/sdk';
import { createWeightedECDSAValidator, getRecoveryAction, getUpdateConfigCall } from '@zerodev/weighted-ecdsa-validator';
import { getValidatorAddress as getEcdsaValidatorAddress, signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getValidatorAddress as getWeightedValidatorAddress } from '@zerodev/weighted-ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/config';
import {
  weightedConfigFor, type WeightedConfig, type PendingRotation, DEFAULT_RECOVERY_DELAY_SECONDS,
} from '@stage-labs/client/zerodev/recovery';
import { deriveOwner } from '@stage-labs/client/zerodev/derive';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { getMnemonic } from './mnemonic';
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

/** ProposalStatus enum (WeightedECDSAValidator). */
export enum ProposalStatus { Ongoing = 0, Approved = 1, Executed = 2, Rejected = 3 }

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

  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable — cannot install guardians.');
  const owner = deriveOwner(mnemonic, rec.hdIndex);
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
  const kernelClient = makeKernelClient(account as Parameters<typeof makeKernelClient>[0], publicClient);

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

/** INITIATOR side: execute the rotation. Builds the guardian validator with the
 *  collected guardian approvals as its signers and sends ONE sponsored doRecovery
 *  userOp. The on-chain `delay` opens the timelock window; the rotation does NOT
 *  take effect until it elapses (or is vetoed). Returns the userOp hash + the
 *  PendingRotation mirror.
 *
 *  NOTE: the guardian signers passed here must be light Signer adapters that
 *  REPLAY the offchain signatures collected over XMTP — they sign no fresh
 *  material. We adapt each collected {guardian,signature} into a Signer whose
 *  signTypedData/signMessage returns the stored signature, which the validator's
 *  signUserOperation concatenates verbatim. */
export async function executeRecovery(
  wallet: Address,
  newOwner: Address,
  cfg: WeightedConfig,
  approvals: Array<{ guardian: Address; signature: Hex }>,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ hash: string; pending: PendingRotation }> {
  if (approvals.length < cfg.threshold) {
    throw new Error(`Need ${cfg.threshold} guardian approvals, have ${approvals.length}.`);
  }
  const publicClient = makePublicClient();
  // Replay-signer adapters: the validator iterates signers and calls
  // signTypedData (all but last) / signMessage (last). Each returns the stored
  // offchain signature, so no guardian key is needed at execution time.
  const signers = approvals.map(a => replaySigner(a.guardian, a.signature));
  const guardianValidator = await buildGuardianValidator(publicClient, cfg, signers as never);

  // Rebuild the recoverable Kernel at the SAME address with the guardian validator
  // as the active validator + the recovery action.
  const account = await createKernelAccount(publicClient, {
    address: wallet,
    plugins: { sudo: guardianValidator, action: getRecoveryAction(ENTRY_POINT.version) },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  const kernelClient = makeKernelClient(account as Parameters<typeof makeKernelClient>[0], publicClient);
  const hash = await kernelClient.sendUserOperation({ callData: recoveryCallData(newOwner) });
  await kernelClient.waitForUserOperationReceipt({ hash });

  const pending: PendingRotation = {
    wallet: wallet.toLowerCase(),
    newOwner: newOwner.toLowerCase(),
    approvedAt: nowSeconds,
    finalizeAfter: nowSeconds + cfg.delay,
  };
  return { hash, pending };
}

/** Read the on-chain pending-rotation status for a wallet + newOwner. Mirrors the
 *  validator's proposalStatus into a PendingRotation (the timelock window is
 *  validAfter). Returns null when there is no live proposal. */
export async function readPendingRotation(
  wallet: Address,
  newOwner: Address,
  nonce: bigint,
): Promise<{ status: ProposalStatus; validAfter: number } | null> {
  const publicClient = makePublicClient();
  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(wallet, callData, nonce);
  const validatorAddress = getWeightedValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  try {
    const [status, validAfter] = await publicClient.readContract({
      abi: WEIGHTED_ABI, address: validatorAddress, functionName: 'proposalStatus', args: [hash, wallet],
    }) as unknown as [number, bigint];
    return { status: status as ProposalStatus, validAfter: Number(validAfter) };
  } catch {
    return null;
  }
}

/** OWNER CANCEL (native veto): during the timelock window the owner cancels a
 *  pending rotation with their passkey/owner key. One sponsored userOp calling
 *  the validator's `veto`. The owner's current Kernel client signs it. */
export async function cancelRecovery(rec: AccountRecord, newOwner: Address, nonce: bigint): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable — cannot cancel recovery.');
  const owner = deriveOwner(mnemonic, rec.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account as Parameters<typeof makeKernelClient>[0], publicClient);

  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(account.address as Address, callData, nonce);
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
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Recovery phrase unavailable — cannot update guardians.');
  const owner = deriveOwner(mnemonic, rec.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account as Parameters<typeof makeKernelClient>[0], publicClient);

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

/** RESUME after a successful (and un-vetoed, timelock-elapsed) rotation: rebuild
 *  the Kernel at the same address with the NEW owner as `sudo`, and return its
 *  client. The XMTP inbox survives (stable SCW address); only a new installation
 *  must re-register via the SCW signer (chainId 8453). */
export async function resumeWithNewOwner(wallet: Address, newOwnerSigner: HDAccount): Promise<KernelAccountClient> {
  const publicClient = makePublicClient();
  const newOwnerValidator = await signerToEcdsaValidator(publicClient, { signer: newOwnerSigner, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION });
  const account = await createKernelAccount(publicClient, {
    address: wallet,
    plugins: { sudo: newOwnerValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  return makeKernelClient(account as Parameters<typeof makeKernelClient>[0], publicClient);
}

/** Adapt a collected offchain {guardian, signature} into a viem-ish Signer that
 *  REPLAYS the stored signature for the validator's signUserOperation. signMessage
 *  / signTypedData both return the stored sig (the validator never re-derives the
 *  message — it concatenates the produced bytes). `address` lets the validator sort
 *  signers by guardian address (matching its on-chain ordering). */
function replaySigner(guardian: Address, signature: Hex) {
  const replay = async () => signature;
  return { address: guardian, signMessage: replay, signTypedData: replay } as never;
}
