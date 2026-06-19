/** @file In-memory observable diagnostics store for the Railgun shielded-balance pipeline (bridge/engine readiness, refresh phase, raw last balanceUpdate event) rendered as the Private-tab debug block. */

/*
 * On-screen diagnostics for the RAILGUN shielded-balance pipeline.
 *
 *  We have NO adb on-device, so this captures the raw truth of the balance flow
 *  into a tiny observable store the Private tab renders as a "Railgun debug"
 *  block: engine/bridge readiness, the last refresh status + error, and — the
 *  key signal — the RAW last `event:balanceUpdate` payload the engine emitted.
 *  This disambiguates the two failure modes:
 *    - engine emits NOTHING → scan/RPC/merkle problem (engine-side, needs APK).
 *    - engine emits buckets but the UI shows 0 → RN-side sum/store/decimals bug.
 *
 *  Pure in-memory + a synchronous getter + subscribe (no disk, no deps).
 */
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
