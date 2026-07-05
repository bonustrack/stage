
type RefreshPhase = 'idle' | 'scanning' | 'done' | 'error';

export interface BalanceDebug {
  bridgeAvailable: boolean;
  engineReady: boolean | null;
  engineError: string | null;
  phase: RefreshPhase;
  refreshAt: number | null;
  refreshError: string | null;
  getBalancesRows: { mainnet: number; sepolia: number } | null;
  lastEventAt: number | null;
  lastEvent: unknown;
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

export function getBalanceDebug(): BalanceDebug {
  return state;
}

export function subscribeBalanceDebug(cb: (s: BalanceDebug) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function patchBalanceDebug(patch: Partial<BalanceDebug>): void {
  state = { ...state, ...patch };
  for (const cb of subs) cb(state);
}

export function recordBalanceEvent(payload: unknown): void {
  patchBalanceDebug({
    lastEvent: payload,
    lastEventAt: Date.now(),
    eventCount: state.eventCount + 1,
  });
}
