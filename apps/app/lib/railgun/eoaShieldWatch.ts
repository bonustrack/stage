/** @file Cheap nonce-delta poller detecting an in-flight EOA->proxy shield with no local tx history (via pending-vs-latest nonce gap + recent-block scan) and registering a synthetic pending action so the Tokens tab shows it until mined. */
import { createPublicClient, http, type Hex } from 'viem';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { RAILGUN_NETWORKS } from './networks';
import { VIEM_CHAINS } from '../../components/tabs/WalletScreen.assets';
import { addPending, pendingStore } from './cache';
import { watchShieldLanding } from './shieldScan';

/** Long poll — never hammer the rate-limited public RPCs. */
const POLL_MS = 25_000;
/** How many recent blocks to inspect when a pending-nonce gap is seen. */
const LOOKBACK_BLOCKS = 3n;

/** Proxy For. */
const proxyFor = (chainId: number): Hex | null => {
  const net = chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
  const cfg = NETWORK_CONFIG[net.networkName];
  return cfg ? (cfg.proxyContract as Hex) : null;
};

/** True when this EOA already has a tracked shield in flight (local or detected), so the watcher doesn't double-register. */
function hasLiveShield(accountId: string, chainId: number): boolean {
  return (pendingStore.get(accountId) ?? []).some(
    p => p.kind === 'shield' && p.chainId === chainId
      && (p.phase === 'proving' || p.phase === 'broadcasting' || p.phase === 'scanning'),
  );
}

/** Minimal viem public client shape this watcher uses for block/nonce reads. */
type ShieldRpcClient = ReturnType<typeof createPublicClient>;

/** Register a synthetic pending shield for a detected EOA->proxy tx hash and hand off to the balance-scan watcher; no-op if already tracked. */
function registerDetectedShield(accountId: string, chainId: number, txHash: Hex): void {
  const id = `shield-eoa-${txHash}`;
  if ((pendingStore.get(accountId) ?? []).some(p => p.id === id)) return;
  addPending(accountId, {
    id, kind: 'shield', symbol: 'ETH', chainId,
    delta: '0', phase: 'broadcasting', txHash, startedAt: Date.now(),
  });
  watchShieldLanding(accountId, id, chainId);
}

/** Scan the latest few blocks for an EOA->proxy shield and register it when found. */
async function scanRecentBlocksForShield(
  client: ShieldRpcClient, accountId: string, eoa: Hex, proxy: Hex, chainId: number,
): Promise<void> {
  const tip = await client.getBlockNumber();
  for (let i = 0n; i < LOOKBACK_BLOCKS; i++) {
    if (tip - i < 0n) break;
    const block = await client.getBlock({ blockNumber: tip - i, includeTransactions: true });
    const hit = block.transactions.find(
      tx => typeof tx !== 'string'
        && tx.from.toLowerCase() === eoa.toLowerCase()
        && tx.to?.toLowerCase() === proxy.toLowerCase(),
    );
    if (hit && typeof hit !== 'string') {
      registerDetectedShield(accountId, chainId, hit.hash);
      return;
    }
  }
}

/** Poll the EOA for an in-flight shield to the Railgun proxy on one chain. */
async function pollOnce(accountId: string, eoa: Hex, chainId: number): Promise<void> {
  if (hasLiveShield(accountId, chainId)) return;
  const chain = VIEM_CHAINS[chainId];
  const net = chainId === 1 ? RAILGUN_NETWORKS.mainnet : RAILGUN_NETWORKS.sepolia;
  const proxy = proxyFor(chainId);
  if (!chain || !proxy) return;
  const client = createPublicClient({ chain, transport: http(net.rpcUrls[0]) });

  const [pendingN, latestN] = await Promise.all([
    client.getTransactionCount({ address: eoa, blockTag: 'pending' }),
    client.getTransactionCount({ address: eoa, blockTag: 'latest' }),
  ]);
  if (pendingN <= latestN) return; /** nothing in flight */

  /** Nonce gap → inspect the latest few blocks for a shield to the proxy. */
  await scanRecentBlocksForShield(client, accountId, eoa, proxy, chainId);
}

/** Start watching the EOA's pending shields across both chains. Returns a stop fn. No-op-safe: swallows RPC errors so a flaky endpoint never breaks the tab. */
export function startEoaShieldWatch(accountId: string, eoa: string): () => void {
  let stopped = false;
  /** Tick helper. */
  const tick = (): void => {
    if (stopped) return;
    void Promise.allSettled([
      pollOnce(accountId, eoa as Hex, 11155111),
      pollOnce(accountId, eoa as Hex, 1),
    ]).catch(() => undefined);
  };
  tick();
  const timer = setInterval(tick, POLL_MS) as unknown as number;
  return () => { stopped = true; clearInterval(timer); };
}
