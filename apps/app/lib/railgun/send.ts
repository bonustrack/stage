/** PRIVATE SEND orchestration — move funds from the user's OWN 0zk shielded
 *  balance to ANOTHER 0zk address (private→private). Pure RN composition over the
 *  bridge primitives + a viem sign/broadcast with the in-app EOA key (the EOA
 *  self-broadcasts + pays gas; the recipient receives shielded).
 *
 *  Flow (REQUIRES a Groth16 proof, like unshield):
 *    derive key material → engineInit → ensureProviderLoaded → walletInfo →
 *    build EIP-1559 gas details (viem) → gasEstimateTransfer →
 *    generateTransferProof (heavy: embedded Groth16 prover, ~10-30s) →
 *    populateProvedTransfer → sign + broadcast the populated tx → confirm.
 *
 *  Self-broadcast only: sendWithPublicWallet=true, no broadcaster fee. Progress +
 *  errors flow through the pending-action store (cache.ts) so the Send page chip
 *  reflects proving → broadcasting → confirmed/failed. The private key is never
 *  logged. Sepolia-first. Mirrors unshield.ts — the only differences are the
 *  recipient is a 0zk address (required) and the transfer primitives. */
import { parseUnits, type Hex } from 'viem';
import { getActiveAccountId } from '../accounts';
import { engineInit, walletInfo } from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { addPending, updatePending } from './cache';
import { ensureProviderLoaded } from './bridge/shieldCalls';
import {
  gasEstimateTransfer, generateTransferProof, populateProvedTransfer,
  type TransferGasDetails, type TransferErc20Recipient,
} from './bridge/transferCalls';
import { getShieldSigner, shieldNetForChainId } from './shieldClient';
import { RAILGUN_TOKENS, type TokenMeta } from './tokens';

const TXID_VERSION = 'V2_PoseidonMerkle';

export interface SendParams {
  /** 1 = mainnet, 11155111 = Sepolia (default for testing). */
  chainId: number;
  /** Token symbol from the shielded list — 'ETH' or 'USDC'. */
  symbol: 'ETH' | 'USDC';
  /** Human-readable amount, e.g. "0.01". */
  amount: string;
  /** 0zk… recipient address (required). */
  recipient: string;
}

export interface SendResult {
  txHash: Hex;
  recipient: string;
}

function tokenMeta(chainId: number, symbol: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported send token: ${symbol}`);
  return meta;
}

/** Run the full private transfer. Resolves with the broadcast tx hash; the
 *  pending chip is driven through `proving` (estimate + Groth16) →
 *  `broadcasting` → `confirmed`/`failed`. The optimistic delta is NEGATIVE. */
export async function sendShielded(params: SendParams): Promise<SendResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('No active account');
  const recipient = params.recipient.trim();
  if (!recipient.toLowerCase().startsWith('0zk')) {
    throw new Error('Recipient must be a 0zk address');
  }
  const cfg = shieldNetForChainId(params.chainId);
  const meta = tokenMeta(params.chainId, params.symbol);
  const amountWei = parseUnits(params.amount, meta.decimals);
  if (amountWei <= 0n) throw new Error('Enter an amount greater than zero');

  const pendingId = `send-${Date.now()}`;
  addPending(accountId, {
    id: pendingId, kind: 'send', symbol: params.symbol, chainId: params.chainId,
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

    const recipients: TransferErc20Recipient[] = [{
      tokenAddress: meta.address, amountWei: amountWei.toString(), recipientAddress: recipient,
    }];

    // EIP-1559 gas details (both Ethereum + Sepolia default to Type2). The
    // gasEstimate is a placeholder for the estimate call; the SDK returns the
    // real estimate which we feed into the populate step.
    const fees = await signer.publicClient.estimateFeesPerGas();
    const baseGas: TransferGasDetails = {
      evmGasType: 2,
      gasEstimate: '0',
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    };

    const est = await gasEstimateTransfer({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients, originalGasDetails: baseGas,
    });

    await generateTransferProof({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients,
    });

    const populated = await populateProvedTransfer({
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
