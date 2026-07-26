import { parseUnits, type Hex } from 'viem';
import { getActiveAccountId } from '../accounts';
import { engineInit, walletInfo } from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { addPending, updatePending } from './cache';
import {
  gasEstimateUnshield, generateUnshieldProof, populateProvedUnshield,
  type UnshieldGasDetails, type UnshieldErc20Recipient,
} from '@stage-labs/client/railgun';
import { sdk } from './bridge/sdk';
import { getShieldSigner, shieldNetForChainId } from './shieldClient';
import { TXID_VERSION, loadShieldProvider, tokenMeta } from './txCommon';

export interface UnshieldParams {
  chainId: number;
  symbol: 'ETH' | 'USDC';
  amount: string;
  recipient?: Hex;
}

export interface UnshieldResult {
  txHash: Hex;
  recipient: Hex;
}

export async function unshieldToPublic(params: UnshieldParams): Promise<UnshieldResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('No active account');
  const cfg = shieldNetForChainId(params.chainId);
  const meta = tokenMeta(params.chainId, params.symbol, 'unshield');
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
    await loadShieldProvider(cfg);
    const info = await walletInfo({
      encryptionKey: key.encryptionKey, mnemonic: key.mnemonic, creationBlocks: key.creationBlocks,
    });
    const signer = await getShieldSigner(cfg);
    const recipient: Hex = params.recipient ?? signer.address;

    const recipients: UnshieldErc20Recipient[] = [{
      tokenAddress: meta.address, amountWei: amountWei.toString(), recipientAddress: recipient,
    }];

    const fees = await signer.publicClient.estimateFeesPerGas();
    const baseGas: UnshieldGasDetails = {
      evmGasType: 2,
      gasEstimate: '0',
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    };

    const est = await gasEstimateUnshield(sdk, {
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients, originalGasDetails: baseGas,
    });

    await generateUnshieldProof(sdk, {
      txidVersion: TXID_VERSION, networkName: cfg.networkName,
      railgunWalletID: info.railgunWalletID, encryptionKey: key.encryptionKey,
      erc20Recipients: recipients,
    });

    const populated = await populateProvedUnshield(sdk, {
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
