import { parseUnits, erc20Abi, type Hex } from 'viem';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { getActiveAccountId } from '../accounts';
import { engineInit, walletInfo } from './bridge';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { addPending, updatePending } from './cache';
import { watchShieldLanding } from './shieldScan';
import { populateShieldBaseToken, populateShieldErc20, ensureProviderLoaded } from './bridge/shieldCalls';
import { getShieldSigner, deriveShieldPrivateKey, shieldNetForChainId } from './shieldClient';
import { RAILGUN_TOKENS } from './tokens';
import type { TokenMeta } from './tokens';

const TXID_VERSION = 'V2_PoseidonMerkle';

export interface ShieldParams {
  chainId: number;
  symbol: 'ETH' | 'USDC';
  amount: string;
}

export interface ShieldResult {
  txHash: Hex;
  zkAddress: string;
}

function tokenMeta(chainId: number, symbol: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported shield token: ${symbol}`);
  return meta;
}

export async function shieldToPrivate(params: ShieldParams): Promise<ShieldResult> {
  const accountId = await getActiveAccountId();
  if (!accountId) throw new Error('No active account');
  const cfg = shieldNetForChainId(params.chainId);
  const meta = tokenMeta(params.chainId, params.symbol);
  const amountWei = parseUnits(params.amount, meta.decimals);
  if (amountWei <= 0n) throw new Error('Enter an amount greater than zero');

  const pendingId = `shield-${Date.now()}`;
  addPending(accountId, {
    id: pendingId, kind: 'shield', symbol: params.symbol, chainId: params.chainId,
    delta: params.amount, phase: 'proving', startedAt: Date.now(),
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
    const shieldPrivateKey = await deriveShieldPrivateKey(signer);

    let populated;
    if (params.symbol === 'ETH') {
      populated = await populateShieldBaseToken({
        txidVersion: TXID_VERSION, networkName: cfg.networkName,
        railgunAddress: info.railgunAddress, shieldPrivateKey,
        wrappedTokenAddress: meta.address, amountWei: amountWei.toString(),
      });
    } else {
      const proxy = NETWORK_CONFIG[cfg.networkName].proxyContract as Hex;
      const approveHash = await signer.walletClient.writeContract({
        account: signer.account, chain: signer.chain,
        address: meta.address as Hex, abi: erc20Abi,
        functionName: 'approve', args: [proxy, amountWei],
      });
      await signer.publicClient.waitForTransactionReceipt({ hash: approveHash });
      populated = await populateShieldErc20({
        txidVersion: TXID_VERSION, networkName: cfg.networkName, shieldPrivateKey,
        tokenAddress: meta.address, amountWei: amountWei.toString(), recipientAddress: info.railgunAddress,
      });
    }

    updatePending(accountId, pendingId, { phase: 'broadcasting' });
    const tx = populated.transaction;
    const txHash = await signer.walletClient.sendTransaction({
      account: signer.account, chain: signer.chain,
      to: tx.to as Hex,
      data: (tx.data ?? '0x') as Hex,
      value: tx.value ? BigInt(tx.value) : (params.symbol === 'ETH' ? amountWei : 0n),
    });
    await signer.publicClient.waitForTransactionReceipt({ hash: txHash });
    updatePending(accountId, pendingId, { txHash });
    watchShieldLanding(accountId, pendingId, params.chainId);
    return { txHash, zkAddress: info.railgunAddress };
  } catch (e) {
    updatePending(accountId, pendingId, { phase: 'failed', error: (e as Error).message });
    throw e;
  }
}
