/** @file SHIELD orchestration: composes the bridge shield primitives plus a viem EOA sign/broadcast (with ERC20 approve when needed) to deposit a public token into the user's own 0zk balance, reporting via the pending-action store. */
/**
 * SHIELD orchestration — deposit a PUBLIC token into the user's OWN 0zk
 *  shielded balance. Pure RN composition over the bridge primitives + a viem
 *  sign/broadcast with the in-app EOA key.
 *
 *  Flow (native ETH, base-token path):
 *    derive key material → engineInit → walletInfo (own 0zk) → EOA signer →
 *    shieldPrivateKey = keccak(EOA sig of fixed msg) → populateShieldBaseToken
 *    (recipient = own 0zk) → sign + broadcast the populated tx → confirm.
 *  ERC20 (USDC) adds an approve to the network proxy contract before populate.
 *
 *  Progress + errors are surfaced through the existing pending-action store
 *  (cache.ts) so WalletScreen.private's chip + the optimistic balance overlay
 *  reflect the in-flight shield without blocking the UI. Recipient is ALWAYS the
 *  user's own 0zk — never an arbitrary address. The private key is never logged.
 */
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
  /** 1 = mainnet, 11155111 = Sepolia (default for testing). */
  chainId: number;
  /** Token symbol from the public list — 'ETH' (native, base-token) or 'USDC'. */
  symbol: 'ETH' | 'USDC';
  /** Human-readable amount, e.g. "0.01". */
  amount: string;
}

export interface ShieldResult {
  txHash: Hex;
  zkAddress: string;
}

/** Token Meta. */
function tokenMeta(chainId: number, symbol: string): TokenMeta {
  const net = chainId === 1 ? 'mainnet' : 'sepolia';
  const meta = RAILGUN_TOKENS[net].find(t => t.symbol === symbol);
  if (!meta) throw new Error(`Unsupported shield token: ${symbol}`);
  return meta;
}

/** Run the full shield. Resolves with the broadcast tx hash; the pending chip is driven through `proving` (populating) → `broadcasting` → `confirmed`/`failed`. */
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
    // Ensure the engine has an RPC provider + merkletree for THIS chain before
    // populating. engineInit (engine.js) loads providers best-effort and swallows
    // per-network RPC failures, so a rate-limited/down public RPC at boot leaves
    // no merkletree → populateShield fails with "txidVersion=null chain=0:<id>".
    // Loading it here (idempotent per chain) surfaces a real RPC error clearly.
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
      // ERC20: approve the proxy contract for this amount, then populate.
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
    // Tx mined — record the hash, then hand off to the merkle-scan watcher which
    // moves the action scanning → confirmed once the note lands in the shielded
    // balance (or after a timeout). Don't mark `confirmed` here: the private
    // balance hasn't been scanned in yet.
    updatePending(accountId, pendingId, { txHash });
    watchShieldLanding(accountId, pendingId, params.chainId);
    return { txHash, zkAddress: info.railgunAddress };
  } catch (e) {
    updatePending(accountId, pendingId, { phase: 'failed', error: (e as Error).message });
    throw e;
  }
}
