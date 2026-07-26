import { parseUnits, type Hex } from 'viem';
import { getActiveAccountId } from '../accounts';
import { engineInit, walletInfo } from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { addPending, updatePending } from './cache';
import {
  gasEstimateTransfer, generateTransferProof, populateProvedTransfer,
  type TransferGasDetails, type TransferErc20Recipient,
} from '@stage-labs/client/railgun';
import { sdk } from './bridge/sdk';
import { getShieldSigner, shieldNetForChainId } from './shieldClient';
import { TXID_VERSION, loadShieldProvider, tokenMeta } from './txCommon';

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

export async function sendShielded(params: SendParams): Promise<SendResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('No active account');
  const recipient = params.recipient.trim();
  if (!recipient.toLowerCase().startsWith('0zk')) {
    throw new Error('Recipient must be a 0zk address');
  }
  const cfg = shieldNetForChainId(params.chainId);
  const meta = tokenMeta(params.chainId, params.symbol, 'send');
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
    await loadShieldProvider(cfg);
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
    const est = await gasEstimateTransfer(sdk, {
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients, originalGasDetails: baseGas,
    });

    step = 'generateTransferProof';
    await generateTransferProof(sdk, {
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients,
    });

    step = 'populateProvedTransfer';
    const populated = await populateProvedTransfer(sdk, {
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
