/**
 * @file "Shield landed privately" watcher: after a shield tx confirms on-chain, subscribes to the engine's `event:balanceUpdate` to resolve the pending action from `scanning` → `confirmed` once the shielded balance lands.
 *  NOTE: there is no real scan-PROGRESS % across the bridge today, so `scanning` is indeterminate and a timeout falls the action back to `confirmed` regardless so the stepper never hangs.
 */
import { bridgeListen } from './bridge';
import { updatePending, removePending } from './cache';
import { refreshSnapshot } from './wallet';

/** Max time to sit in the indeterminate `scanning` state before declaring the shield confirmed regardless (the on-chain tx already succeeded). */
const SCAN_TIMEOUT_MS = 4 * 60_000;

interface BalanceUpdatePayload { chainId?: number; walletId?: string; rows?: unknown[] }

/**
 * Begin watching for the shielded balance to land for a confirmed shield.
 *  Marks the pending action `scanning` immediately, then resolves it to
 *  `confirmed` (and refreshes the snapshot) on the first balance-update for the
 *  matching chain, or after SCAN_TIMEOUT_MS. Cheap: one bridge listener, torn
 *  down as soon as it resolves.
 */
export function watchShieldLanding(accountId: string, pendingId: string, chainId: number): void {
  updatePending(accountId, pendingId, { phase: 'scanning' });

  let done = false;

  /** Finish helper. */
  const finish = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    unsub();
    updatePending(accountId, pendingId, { phase: 'confirmed' });
    void refreshSnapshot(accountId).then(() => { removePending(accountId, pendingId); });
  };

  const unsub = bridgeListen('event:balanceUpdate', (payload: unknown) => {
    const p = payload as BalanceUpdatePayload;
    // A scan for this chain produced fresh balances — the shield has landed (or
    // is about to be reflected by the snapshot refresh). Resolve.
    if (p && (p.chainId == null || p.chainId === chainId)) finish();
  });

  const timer = setTimeout(finish, SCAN_TIMEOUT_MS);
}
