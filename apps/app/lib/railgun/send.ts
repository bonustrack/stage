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
  chainId: number;
  symbol: 'ETH' | 'USDC';
  amount: string;
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

  let step = 'init';
  try {
    const key = await deriveRailgunKeyMaterial();
    step = 'engineInit'; await engineInit();
    step = 'providerLoad';
    await ensureProviderLoaded(
      {
        chainId: cfg.chainId,
        providers: cfg.rpcUrls.map((url, i) => ({ provider: url, priority: i + 1, weight: 1 })),
      },
      cfg.networkName,
    );
    step = 'walletInfo';
    const info = await walletInfo({
      encryptionKey: key.encryptionKey, mnemonic: key.mnemonic, creationBlocks: key.creationBlocks,
    });
    const signer = await getShieldSigner(cfg);

    const recipients: TransferErc20Recipient[] = [{
      tokenAddress: meta.address, amountWei: amountWei.toString(), recipientAddress: recipient,
    }];

    step = 'estimateFees';
    const fees = await signer.publicClient.estimateFeesPerGas();
    const baseGas: TransferGasDetails = {
      evmGasType: 2,
      gasEstimate: '0',
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    };

    step = 'gasEstimateTransfer';
    const est = await gasEstimateTransfer({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients, originalGasDetails: baseGas,
    });

    step = 'generateTransferProof';
    await generateTransferProof({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients,
    });

    step = 'populateProvedTransfer';
    const populated = await populateProvedTransfer({
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, erc20Recipients: recipients,
      gasDetails: { ...baseGas, gasEstimate: est.gasEstimate },
    });

    updatePending(accountId, pendingId, { phase: 'broadcasting' });
    const tx = populated.transaction;
    step = 'broadcast';
    const txHash = await signer.walletClient.sendTransaction({
      account: signer.account, chain: signer.chain,
      to: tx.to as Hex,
      data: (tx.data ?? '0x') as Hex,
      value: tx.value ? BigInt(tx.value) : 0n,
    });
    step = 'waitReceipt';
    await signer.publicClient.waitForTransactionReceipt({ hash: txHash });
    updatePending(accountId, pendingId, { phase: 'confirmed', txHash });
    return { txHash, recipient };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = raw?.trim() ? raw : `Unknown error (no message) at step "${step}"`;
    console.error(`[sendShielded] failed at step="${step}":`, e);
    updatePending(accountId, pendingId, { phase: 'failed', error: msg });
    const wrapped = new Error(`${msg} (at ${step})`) as Error & { step?: string; cause?: unknown };
    wrapped.step = step;
    wrapped.cause = e;
    throw wrapped;
  }
}
