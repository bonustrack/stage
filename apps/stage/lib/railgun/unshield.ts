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
  chainId: number;
  symbol: 'ETH' | 'USDC';
  amount: string;
  recipient?: Hex;
}

export interface UnshieldResult {
  txHash: Hex;
  recipient: Hex;
}

function tokenMeta(chainId: number, symbol: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported unshield token: ${symbol}`);
  return meta;
}

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
