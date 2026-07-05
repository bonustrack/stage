import { bridgeListen } from './bridge';
import { updatePending, removePending } from './cache';
import { refreshSnapshot } from './wallet';

const SCAN_TIMEOUT_MS = 4 * 60_000;

interface BalanceUpdatePayload { chainId?: number; walletId?: string; rows?: unknown[] }

export function watchShieldLanding(accountId: string, pendingId: string, chainId: number): void {
  updatePending(accountId, pendingId, { phase: 'scanning' });

  let done = false;

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
    if (p && (p.chainId == null || p.chainId === chainId)) finish();
  });

  const timer = setTimeout(finish, SCAN_TIMEOUT_MS);
}
