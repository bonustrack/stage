/** "Shield landed privately" watcher.
 *
 *  After a shield tx confirms on-chain (EOA receipt), the deposited note still
 *  has to be picked up by the Railgun engine's merkletree scan before it shows
 *  in the shielded balance. The host already emits `event:balanceUpdate` after
 *  each scan (engine.js:188) — we subscribe to it and resolve the pending action
 *  from `scanning` → `confirmed` once a balance row for the shielded token
 *  actually increases. If no scan-progress signal arrives, a timeout falls the
 *  action back to `confirmed` anyway so the stepper never hangs forever.
 *
 *  NOTE: there is no real scan-PROGRESS % across the bridge today (it would need
 *  setOnUTXOMerkletreeScanCallback wired in engine.js + a new APK). So the
 *  'Scanning' stage is an indeterminate state that resolves on balance-landed. */
import { bridgeListen } from '@metro-labs/railgun-mobile/bridge';
import { updatePending, removePending } from './cache';
import { refreshSnapshot } from './wallet';

/** Max time to sit in the indeterminate `scanning` state before declaring the
 *  shield confirmed regardless (the on-chain tx already succeeded). */
const SCAN_TIMEOUT_MS = 4 * 60_000;

interface BalanceUpdatePayload { chainId?: number; walletId?: string; rows?: unknown[] }

/** Begin watching for the shielded balance to land for a confirmed shield.
 *  Marks the pending action `scanning` immediately, then resolves it to
 *  `confirmed` (and refreshes the snapshot) on the first balance-update for the
 *  matching chain, or after SCAN_TIMEOUT_MS. Cheap: one bridge listener, torn
 *  down as soon as it resolves. */
export function watchShieldLanding(accountId: string, pendingId: string, chainId: number): void {
  updatePending(accountId, pendingId, { phase: 'scanning' });

  let done = false;

  const finish = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    unsub();
    updatePending(accountId, pendingId, { phase: 'confirmed' });
    void refreshSnapshot(accountId).then(() => removePending(accountId, pendingId));
  };

  const unsub = bridgeListen('event:balanceUpdate', (payload: unknown) => {
    const p = payload as BalanceUpdatePayload;
    // A scan for this chain produced fresh balances — the shield has landed (or
    // is about to be reflected by the snapshot refresh). Resolve.
    if (p && (p.chainId == null || p.chainId === chainId)) finish();
  });

  const timer = setTimeout(finish, SCAN_TIMEOUT_MS);
}
