import { getActiveAccount } from './accounts';
import { report } from './errorPolicy';

export function createVisibilityPublisher(send: (accountId: string) => Promise<boolean>, delayMs = 800) {
  const pending = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const running = new Set<string>();
  const paused = new Set<string>();

  function schedule(accountId: string, delay: number): void {
    clearTimeout(timers.get(accountId));
    timers.set(accountId, setTimeout(() => {
      timers.delete(accountId);
      void flush(accountId, delay);
    }, delay));
  }

  function settle(accountId: string, revision: number | undefined, sent: boolean, delay: number): void {
    if (sent && revision === pending.get(accountId)) pending.delete(accountId);
    if (pending.has(accountId)) schedule(accountId, sent ? delayMs : Math.min(60_000, Math.max(5_000, delay * 2)));
  }

  async function flush(accountId: string, delay: number): Promise<void> {
    if (running.has(accountId) || paused.has(accountId)) return;
    running.add(accountId);
    const revision = pending.get(accountId);
    try {
      if ((await getActiveAccount())?.id !== accountId) return;
      settle(accountId, revision, await send(accountId), delay);
    } catch (err) {
      report('readSync.visibility', err);
      if (/429|resource.?exhausted|rate.?limit|too many requests/i.test(String(err))) paused.add(accountId);
      else schedule(accountId, Math.min(60_000, Math.max(5_000, delay * 2)));
    } finally {
      running.delete(accountId);
    }
  }

  return (accountId: string): void => {
    pending.set(accountId, (pending.get(accountId) ?? 0) + 1);
    schedule(accountId, delayMs);
  };
}
