/** @file "Shield landed privately" watcher: after a shield tx confirms, listens for `event:balanceUpdate` to move the pending action `scanning` → `confirmed`; since there's no real progress %, `scanning` is indeterminate and a timeout falls back to `confirmed` so the stepper never hangs. */
import { bridgeListen } from './bridge';
import { updatePending, removePending } from './cache';
import { refreshSnapshot } from './wallet';

/** Max time to sit in the indeterminate `scanning` state before declaring the shield confirmed regardless (the on-chain tx already succeeded). */
const SCAN_TIMEOUT_MS = 4 * 60_000;

interface BalanceUpdatePayload { chainId?: number; walletId?: string; rows?: unknown[] }

/** Watch for a confirmed shield's balance to land: mark the action `scanning`, then resolve to `confirmed` (and refresh the snapshot) on the first matching-chain balance-update or after SCAN_TIMEOUT_MS, via one self-tearing-down bridge listener. */
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
    /** A scan for this chain produced fresh balances — the shield has landed (or is about to be reflected by the snapshot refresh). Resolve. */
    if (p && (p.chainId == null || p.chainId === chainId)) finish();
  });

  const timer = setTimeout(finish, SCAN_TIMEOUT_MS);
}
