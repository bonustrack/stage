/** @file In-memory observable diagnostics store for the Railgun shielded-balance pipeline (bridge/engine readiness, refresh phase, raw last balanceUpdate event) rendered as the Private-tab debug block. */

/** Pure in-memory observable store (getter + subscribe, no disk/deps) capturing the RAILGUN shielded-balance flow for the Private tab's debug block — engine/bridge readiness, last refresh status/error, and the raw last `event:balanceUpdate` payload — to disambiguate engine-side scan failures from RN-side sum/store/decimals bugs. */
type RefreshPhase = 'idle' | 'scanning' | 'done' | 'error';

export interface BalanceDebug {
  /** isBridgeAvailable() — is the nodejs-mobile runtime in this binary? */
  bridgeAvailable: boolean;
  /** Last engineInit/status result (ready/prover/networks) as seen by refresh. */
  engineReady: boolean | null;
  engineError: string | null;
  /** Where the last refreshSnapshot got to + when. */
  phase: RefreshPhase;
  refreshAt: number | null;
  refreshError: string | null;
  /** The one-shot getBalances() result rows count per net (initial scan). */
  getBalancesRows: { mainnet: number; sepolia: number } | null;
  /** RAW last `event:balanceUpdate` payload the engine pushed (or null). This is the load-bearing signal — JSON of {chainId, walletId, rows:[{tokenAddress, amount}]}. "none received yet" means the engine emitted no balance event. */
  lastEventAt: number | null;
  lastEvent: unknown;
  /** Count of balanceUpdate events received since boot. */
  eventCount: number;
}

let state: BalanceDebug = {
  bridgeAvailable: false,
  engineReady: null,
  engineError: null,
  phase: 'idle',
  refreshAt: null,
  refreshError: null,
  getBalancesRows: null,
  lastEventAt: null,
  lastEvent: null,
  eventCount: 0,
};

const subs = new Set<(s: BalanceDebug) => void>();

/** Current balance-debug state snapshot. */
export function getBalanceDebug(): BalanceDebug {
  return state;
}

/** Subscribe to balance-debug state changes. Returns an unsubscribe fn. */
export function subscribeBalanceDebug(cb: (s: BalanceDebug) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** Merge a partial update + notify subscribers. */
export function patchBalanceDebug(patch: Partial<BalanceDebug>): void {
  state = { ...state, ...patch };
  for (const cb of subs) cb(state);
}

/** Record a raw `event:balanceUpdate` payload from the engine bridge. */
export function recordBalanceEvent(payload: unknown): void {
  patchBalanceDebug({
    lastEvent: payload,
    lastEventAt: Date.now(),
    eventCount: state.eventCount + 1,
  });
}
