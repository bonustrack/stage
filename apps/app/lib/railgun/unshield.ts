/** UNSHIELD orchestration — move funds from the user's OWN 0zk shielded balance
 *  back to a PUBLIC address (default: the user's own EOA). Pure RN composition
 *  over the bridge primitives + a viem sign/broadcast with the in-app EOA key.
 *
 *  Flow (REQUIRES a Groth16 proof, unlike shield):
 *    derive key material → engineInit → ensureProviderLoaded → walletInfo →
 *    build EIP-1559 gas details (viem) → gasEstimateUnshield →
 *    generateUnshieldProof (heavy: embedded Groth16 prover, ~10-30s) →
 *    populateProvedUnshield → sign + broadcast the populated tx → confirm.
 *
 *  Self-broadcast only: sendWithPublicWallet=true, no broadcaster fee. The
 *  recipient defaults to the user's own EOA (the same key the 0zk wallet derives
 *  from). Progress + errors flow through the pending-action store (cache.ts) so
 *  the Private tab chip reflects proving → broadcasting → confirmed/failed. The
 *  private key is never logged. Sepolia-first. */
import { parseUnits, type Hex } from 'viem';
import { getActiveAccountId } from '../accounts';
import { engineInit, walletInfo } from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { addPending, updatePending } from './cache';
import { ensureProviderLoaded } from './bridge/shieldCalls';
import {
  gasEstimateUnshield, generateUnshieldProof, populateProvedUnshield,
  type UnshieldGasDetails, type UnshieldErc20Recipient,
} from './bridge/unshieldCalls';
import { getShieldSigner, shieldNetForChainId } from './shieldClient';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

const TXID_VERSION = 'V2_PoseidonMerkle';

export interface UnshieldParams {
  /** 1 = mainnet, 11155111 = Sepolia (default for testing). */
  chainId: number;
  /** Token symbol from the shielded list — 'ETH' or 'USDC'. */
  symbol: 'ETH' | 'USDC';
  /** Human-readable amount, e.g. "0.01". */
  amount: string;
  /** Public recipient; defaults to the user's own EOA when omitted. */
  recipient?: Hex;
}

export interface UnshieldResult {
  txHash: Hex;
  recipient: Hex;
}

/** Token Meta. */
function tokenMeta(chainId: number, symbol: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported unshield token: ${symbol}`);
  return meta;
}

/** Run the full unshield. Resolves with the broadcast tx hash; the pending chip
 *  is driven through `proving` (estimate + Groth16) → `broadcasting` →
 *  `confirmed`/`failed`. The optimistic delta is NEGATIVE (funds leaving). */
export async function unshieldToPublic(params: UnshieldParams): Promise<UnshieldResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('No active account');
  const cfg = shieldNetForChainId(params.chainId);
  const meta = tokenMeta(params.chainId, params.symbol);
  const amountWei = parseUnits(params.amount, meta.decimals);
  if (amountWei <= 0n) throw new Error('Enter an amount greater than zero');

  const pendingId = `unshield-${Date.now()}`;
  addPending(accountId, {
    id: pendingId, kind: 'unshield', symbol: params.symbol, chainId: params.chainId,
    delta: `-${params.amount}`, phase: 'proving', startedAt: Date.now(),
  });

  try {
    const key = await deriveRailgunKeyMaterial();
    await engineInit();
    await ensureProviderLoaded(
      {
        chainId: cfg.chainId,
        providers: cfg.rpcUrls.map((url, i) => ({ provider: url, priority: i + 1, weight: 1 })),
      },
      cfg.networkName,
    );
    const info = await walletInfo({
      encryptionKey: key.encryptionKey, mnemonic: key.mnemonic, creationBlocks: key.creationBlocks,
    });
    const signer = await getShieldSigner(cfg);
    const recipient: Hex = params.recipient ?? signer.address;

    const recipients: UnshieldErc20Recipient[] = [{
      tokenAddress: meta.address, amountWei: amountWei.toString(), recipientAddress: recipient,
    }];

    // EIP-1559 gas details (both Ethereum + Sepolia default to Type2). The
    // gasEstimate is a placeholder for the estimate call; the SDK returns the
    // real estimate which we feed into the populate step.
    const fees = await signer.publicClient.estimateFeesPerGas();
    const baseGas: UnshieldGasDetails = {
      evmGasType: 2,
      gasEstimate: '0',
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    };

    const est = await gasEstimateUnshield({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients, originalGasDetails: baseGas,
    });

    await generateUnshieldProof({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients,
    });

    const populated = await populateProvedUnshield({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, erc20Recipients: recipients,
      gasDetails: { ...baseGas, gasEstimate: est.gasEstimate },
    });

    updatePending(accountId, pendingId, { phase: 'broadcasting' });
    const tx = populated.transaction;
    const txHash = await signer.walletClient.sendTransaction({
      account: signer.account, chain: signer.chain,
      to: tx.to as Hex,
      data: (tx.data ?? '0x') as Hex,
      value: tx.value ? BigInt(tx.value) : 0n,
    });
    await signer.publicClient.waitForTransactionReceipt({ hash: txHash });
    updatePending(accountId, pendingId, { phase: 'confirmed', txHash });
    return { txHash, recipient };
  } catch (e) {
    updatePending(accountId, pendingId, { phase: 'failed', error: (e as Error).message });
    throw e;
  }
}
