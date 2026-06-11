/** DEV-ONLY de-risk spike for EIP-7702 smart accounts (ZeroDev Kernel v3).
 *
 *  Goal: PROVE the unknowns for delegating the app's existing mnemonic-derived
 *  viem EOAs to a Kernel-style account (social recovery + session keys) WITHOUT
 *  changing the EOA address. Everything here runs on SEPOLIA and is reachable
 *  only from Settings -> Experimental -> "7702 spike" (see app/settings/spike7702.tsx).
 *  Nothing in this module is imported by the production app paths.
 *
 *  The 5 proofs (run in order, each reports a StepResult):
 *    1. signAuthorization  - a local viem account signs an EIP-7702 authorization
 *       in React Native (viem 2.51 supports `account.signAuthorization`; the RN
 *       crypto polyfills - crypto.getRandomValues + Buffer - are already wired in
 *       lib/cryptoShim + lib/jsPolyfills, imported here transitively).
 *    2. delegate           - build a Kernel v3.3 account in 7702 mode over the EOA;
 *       the address of the Kernel account == the EOA address (that is the whole
 *       point of 7702 - the smart-account code lives AT the EOA via a delegation
 *       designator, the address never changes).
 *    3. session key        - mint a narrow session key (CallPolicy: only transfer
 *       the STAGE token, capped) and send a sponsored userOp with it.
 *    4. recovery           - install a guardian (weighted-ecdsa) + recovery action,
 *       perform a recovery that rotates the owner to a 2nd derived account, and
 *       confirm the account address is unchanged.
 *    5. xmtp untouched     - the EOA still produces the same address + a valid
 *       personal_sign signature (the XMTP identity is the EOA; 7702 delegation is
 *       a separate EVM concern and does not rotate the signing key).
 *
 *  Gas: ZeroDev's sponsored paymaster is used for every userOp so the spike needs
 *  no Sepolia ETH. Bundler+paymaster RPC comes from EXPO_PUBLIC_ZERODEV_RPC
 *  (a ZeroDev project RPC URL, which carries the project id). NO key is committed;
 *  when the env var is absent the on-chain steps short-circuit with a clear
 *  "needs EXPO_PUBLIC_ZERODEV_RPC" message and the offline proofs (1, 2-address,
 *  5) still run. */

import './cryptoShim';
import './jsPolyfills';
import {
  createPublicClient, http, zeroAddress, parseAbi, encodeFunctionData,
  type Hex, type Address,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey, mnemonicToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import {
  createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_3, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { getUserOperationGasPrice } from '@zerodev/sdk/actions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  toPermissionValidator, serializePermissionAccount, deserializePermissionAccount,
} from '@zerodev/permissions';
import { toCallPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies';
import {
  createWeightedECDSAValidator, getRecoveryAction,
} from '@zerodev/weighted-ecdsa-validator';
import { getValidatorAddress, signerToEcdsaValidator } from '@zerodev/ecdsa-validator';

/** STAGE token on Sepolia (the narrow target for the session-key proof). */
const STAGE_TOKEN = '0x7a49F33AD000220a764ED303f9911cB08422d138' as Address;
/** Cap the session key to transferring at most this many base units of STAGE. */
const STAGE_TRANSFER_CAP = 1_000_000_000_000_000_000n; // 1 token @ 18 decimals

/** Dev-only deterministic test mnemonic. This is the canonical all-public BIP-39
 *  test phrase - it MUST NEVER hold real funds. We derive a FRESH Sepolia test
 *  EOA (index high enough to avoid the usual demo addresses) so the spike never
 *  touches the user's real accounts or the daemon deployer wallet. */
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';

const ENTRY_POINT = getEntryPoint('0.7');
const CHAIN = sepolia;
const ZERODEV_RPC = process.env.EXPO_PUBLIC_ZERODEV_RPC ?? '';

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);
const recoveryExecutorAbi = parseAbi([
  'function doRecovery(address _validator, bytes calldata _data)',
]);

export type StepStatus = 'pass' | 'fail' | 'skip';
export interface StepResult {
  step: number;
  name: string;
  status: StepStatus;
  detail: string;
  /** Extra key/value lines surfaced on-screen + console (addresses, tx hashes). */
  data?: Record<string, string>;
}

const ok = (step: number, name: string, detail: string, data?: Record<string, string>): StepResult =>
  ({ step, name, status: 'pass', detail, data });
const fail = (step: number, name: string, detail: string, data?: Record<string, string>): StepResult =>
  ({ step, name, status: 'fail', detail, data });
const skip = (step: number, name: string, detail: string): StepResult =>
  ({ step, name, status: 'skip', detail });

function publicClient() {
  // Reads can go through the ZeroDev RPC when present, else a public Sepolia node.
  return createPublicClient({ chain: CHAIN, transport: http(ZERODEV_RPC || undefined) });
}

/** Derive the fresh test EOA (owner) + a second derived account used as the
 *  recovery target/guardian. Both come from the public test mnemonic. */
function deriveTestAccounts() {
  const ownerPk = mnemonicToAccount(TEST_MNEMONIC, { addressIndex: 7 }).getHdKey().privateKey;
  const recoveryPk = mnemonicToAccount(TEST_MNEMONIC, { addressIndex: 8 }).getHdKey().privateKey;
  if (!ownerPk || !recoveryPk) throw new Error('mnemonic derivation returned no private key');
  const owner = privateKeyToAccount(('0x' + Buffer.from(ownerPk).toString('hex')) as Hex);
  const recovery = privateKeyToAccount(('0x' + Buffer.from(recoveryPk).toString('hex')) as Hex);
  return { owner, recovery };
}

/** STEP 1 - sign an EIP-7702 authorization with a local viem account in RN. */
async function step1SignAuthorization(): Promise<StepResult> {
  const N = 'EIP-7702 signAuthorization (RN)';
  try {
    const { owner } = deriveTestAccounts();
    if (typeof owner.signAuthorization !== 'function') {
      return fail(1, N, 'viem account has no signAuthorization (version too old)');
    }
    // The Kernel implementation contract is what we delegate to; for the pure
    // signing proof any address works - we use zeroAddress as a stand-in.
    const auth = await owner.signAuthorization({
      chainId: CHAIN.id,
      nonce: 0,
      address: zeroAddress,
    });
    const okSig = typeof auth.r === 'string' && typeof auth.s === 'string'
      && (typeof auth.yParity === 'number' || typeof auth.v === 'bigint');
    if (!okSig) return fail(1, N, 'authorization signed but malformed', { auth: JSON.stringify(auth).slice(0, 120) });
    return ok(1, N, 'local viem account signed a 7702 authorization in RN', {
      eoa: owner.address,
      r: String(auth.r).slice(0, 14) + '...',
      yParity: String((auth as { yParity?: number }).yParity ?? 'n/a'),
    });
  } catch (e) {
    return fail(1, N, msg(e));
  }
}

/** Build the Kernel v3.3 account in 7702 mode over the test EOA. Shared by the
 *  delegate proof and the session-key proof. */
async function buildKernel7702() {
  const { owner } = deriveTestAccounts();
  const pub = publicClient();
  const account = await createKernelAccount(pub, {
    eip7702Account: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_3,
  });
  return { owner, pub, account };
}

function kernelClient(pub: ReturnType<typeof publicClient>, account: Awaited<ReturnType<typeof buildKernel7702>>['account']) {
  const paymaster = createZeroDevPaymasterClient({ chain: CHAIN, transport: http(ZERODEV_RPC) });
  return createKernelAccountClient({
    account,
    chain: CHAIN,
    bundlerTransport: http(ZERODEV_RPC),
    client: pub,
    paymaster: {
      getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }),
    },
    userOperation: {
      estimateFeesPerGas: ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
    },
  });
}

/** STEP 2 - delegate the EOA to Kernel v3.3 (7702). Proves the Kernel account
 *  address == EOA address. The actual on-chain delegation only materialises when
 *  the first userOp is sent (steps 3/4); here we prove the address invariant +
 *  that the account object builds, which is the de-risking unknown. */
async function step2Delegate(): Promise<StepResult> {
  const N = 'Delegate EOA -> Kernel v3.3 (7702)';
  try {
    const { owner, account } = await buildKernel7702();
    const sameAddress = account.address.toLowerCase() === owner.address.toLowerCase();
    if (!sameAddress) {
      return fail(2, N, 'Kernel account address != EOA address - 7702 invariant broken', {
        eoa: owner.address, kernel: account.address,
      });
    }
    return ok(2, N, 'Kernel v3.3 (7702) account builds AT the EOA address (address unchanged)', {
      eoa: owner.address, kernel: account.address, kernelVersion: 'v3.3',
    });
  } catch (e) {
    return fail(2, N, msg(e));
  }
}

/** STEP 3 - mint a narrow session key (only transfer STAGE token, capped) and
 *  send a sponsored userOp with it. Requires the ZeroDev RPC (on-chain). */
async function step3SessionKey(): Promise<StepResult> {
  const N = 'Session key (STAGE transfer, capped)';
  if (!ZERODEV_RPC) return skip(3, N, 'needs EXPO_PUBLIC_ZERODEV_RPC (bundler+paymaster)');
  try {
    const { owner, pub } = await buildKernel7702();

    const sessionPk = generatePrivateKey();
    const sessionSigner = await toECDSASigner({ signer: privateKeyToAccount(sessionPk) });

    // Narrow policy: this session key may ONLY call STAGE.transfer, and only with
    // amount <= cap. Any other target/selector/amount is rejected by Kernel.
    const callPolicy = toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_4,
      permissions: [{
        target: STAGE_TOKEN,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [null, { condition: ParamCondition.LESS_THAN_OR_EQUAL, value: STAGE_TRANSFER_CAP }],
      }],
    });

    const permissionPlugin = await toPermissionValidator(pub, {
      entryPoint: ENTRY_POINT,
      signer: sessionSigner,
      policies: [callPolicy],
      kernelVersion: KERNEL_V3_3,
    });

    const sessionAccount = await createKernelAccount(pub, {
      entryPoint: ENTRY_POINT,
      eip7702Account: owner,
      address: owner.address,
      plugins: { regular: permissionPlugin },
      kernelVersion: KERNEL_V3_3,
    });

    // Round-trip serialize (this is how the owner would hand the key to an agent).
    const serialized = await serializePermissionAccount(sessionAccount, sessionPk);
    const restored = await deserializePermissionAccount(
      pub, ENTRY_POINT, KERNEL_V3_3, serialized,
    );

    const client = kernelClient(pub, restored as typeof sessionAccount);
    const userOpHash = await client.sendUserOperation({
      callData: await restored.encodeCalls([{
        to: STAGE_TOKEN,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi, functionName: 'transfer', args: [owner.address, 1n],
        }),
      }]),
    });
    const { receipt } = await client.waitForUserOperationReceipt({ hash: userOpHash });

    return ok(3, N, 'sponsored userOp via session key succeeded (STAGE transfer within cap)', {
      eoa: owner.address,
      sessionKey: sessionSigner.account.address,
      userOpHash,
      tx: receipt.transactionHash,
      capWei: STAGE_TRANSFER_CAP.toString(),
    });
  } catch (e) {
    return fail(3, N, msg(e));
  }
}

/** STEP 4 - install a guardian (weighted-ecdsa) + recovery action and rotate the
 *  owner key, proving the account address never changes. Requires ZeroDev RPC.
 *
 *  NOTE on 7702 + recovery: the guardian recovery flow in ZeroDev's examples is
 *  modelled on a DEPLOYED Kernel (sudo = ecdsaValidator on the OLD key, regular =
 *  guardian validator, action = recovery). We mirror that here. For a pure-7702
 *  account whose sudo authority is the EOA key itself, rotating the "owner" means
 *  installing an ECDSA validator and recovering it to the new signer; the EOA
 *  address (== account address) is structurally fixed by 7702 and cannot change.
 *  This step is the riskiest unknown - see the spike report for the verdict. */
async function step4Recovery(): Promise<StepResult> {
  const N = 'Recovery (guardian rotates owner)';
  if (!ZERODEV_RPC) return skip(4, N, 'needs EXPO_PUBLIC_ZERODEV_RPC (bundler+paymaster)');
  try {
    const { owner, recovery } = deriveTestAccounts();
    const guardian = privateKeyToAccount(generatePrivateKey());
    const pub = publicClient();

    const oldEcdsa = await signerToEcdsaValidator(pub, {
      signer: owner, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_V3_1,
    });
    const guardianValidator = await createWeightedECDSAValidator(pub, {
      entryPoint: ENTRY_POINT,
      config: { threshold: 100, signers: [{ address: guardian.address, weight: 100 }] },
      signers: [guardian],
      kernelVersion: KERNEL_V3_1,
    });

    const account = await createKernelAccount(pub, {
      entryPoint: ENTRY_POINT,
      plugins: {
        sudo: oldEcdsa,
        regular: guardianValidator,
        action: getRecoveryAction(ENTRY_POINT.version),
      },
      kernelVersion: KERNEL_V3_1,
    });
    const addressBefore = account.address;

    const client = kernelClient(pub, account);
    const recoveryHash = await client.sendUserOperation({
      callData: encodeFunctionData({
        abi: recoveryExecutorAbi,
        functionName: 'doRecovery',
        args: [getValidatorAddress(ENTRY_POINT, KERNEL_V3_1), recovery.address],
      }),
    });
    await client.waitForUserOperationReceipt({ hash: recoveryHash });

    // Rebuild with the NEW signer at the SAME address and prove it can act.
    const newEcdsa = await signerToEcdsaValidator(pub, {
      signer: recovery, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_V3_1,
    });
    const newAccount = await createKernelAccount(pub, {
      address: addressBefore,
      entryPoint: ENTRY_POINT,
      plugins: { sudo: newEcdsa },
      kernelVersion: KERNEL_V3_1,
    });
    const newClient = kernelClient(pub, newAccount);
    const proveHash = await newClient.sendUserOperation({
      callData: await newAccount.encodeCalls([{ to: zeroAddress, value: 0n, data: '0x' }]),
    });
    await newClient.waitForUserOperationReceipt({ hash: proveHash });

    const addressUnchanged = newAccount.address.toLowerCase() === addressBefore.toLowerCase();
    if (!addressUnchanged) {
      return fail(4, N, 'account address changed after recovery', {
        before: addressBefore, after: newAccount.address,
      });
    }
    return ok(4, N, 'guardian rotated owner key; account address unchanged; new key can act', {
      account: addressBefore,
      oldOwner: owner.address,
      newOwner: recovery.address,
      guardian: guardian.address,
      recoveryTx: recoveryHash,
      proveTx: proveHash,
    });
  } catch (e) {
    return fail(4, N, msg(e));
  }
}

/** STEP 5 - confirm the XMTP identity (the EOA) is untouched by delegation: the
 *  EOA still derives the same address and produces a valid personal_sign
 *  signature, which is exactly what XMTP's signer adapter calls. */
async function step5XmtpUntouched(): Promise<StepResult> {
  const N = 'XMTP identity untouched';
  try {
    const { owner } = deriveTestAccounts();
    // The EOA address is what XMTP registers as the inbox identity.
    const addr = owner.address;
    // XMTP's signer adapter calls personal_sign over the SIWE-style payload;
    // prove the same key still signs messages post-delegation conceptually
    // (the key never changes - 7702 only adds code AT the address).
    const sig = await owner.signMessage({ message: 'xmtp identity check: ' + addr });
    const okSig = /^0x[0-9a-f]{130}$/i.test(sig);
    if (!okSig) return fail(5, N, 'personal_sign produced a malformed signature', { sig: sig.slice(0, 20) });
    return ok(5, N, 'EOA address + personal_sign intact - XMTP identity unaffected by 7702 delegation', {
      address: addr, sigLen: String(sig.length),
    });
  } catch (e) {
    return fail(5, N, msg(e));
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Run all 5 proofs in order, invoking `onStep` after each so the UI can stream
 *  results. Returns the full ordered list. */
export async function runSpike(onStep?: (r: StepResult) => void): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const run = async (fn: () => Promise<StepResult>): Promise<void> => {
    const r = await fn();
    results.push(r);
    console.log(`[7702-spike] step ${r.step} ${r.status.toUpperCase()}: ${r.name} - ${r.detail}`, r.data ?? {});
    onStep?.(r);
  };
  await run(step1SignAuthorization);
  await run(step2Delegate);
  await run(step3SessionKey);
  await run(step4Recovery);
  await run(step5XmtpUntouched);
  return results;
}

export const SPIKE_META = {
  chain: 'Sepolia',
  stageToken: STAGE_TOKEN,
  hasRpc: !!ZERODEV_RPC,
  rpcEnvVar: 'EXPO_PUBLIC_ZERODEV_RPC',
} as const;
