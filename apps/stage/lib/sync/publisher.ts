import { backoffDelay } from '@stage-labs/client/timing';
import { AccountChangedError, NoAccountError, readActiveAccountId } from '../accountSelection';
import { report } from '../errorPolicy';

export interface SyncJob {
  key: string;
  accountId?: string;
  delayMs?: number;
  send: () => Promise<void>;
}

const PUBLISH_DEBOUNCE_MS = 800;
const RATE_LIMITED = /429|resource.?exhausted|rate.?limit|too many requests/i;

interface Pending {
  job: SyncJob;
  revision: number;
}

async function isActiveAccount(accountId: string): Promise<boolean> {
  return (await readActiveAccountId()) === accountId;
}

export function createSyncPublisher(isActive: (accountId: string) => Promise<boolean> = isActiveAccount): (job: SyncJob) => void {
  const pending = new Map<string, Pending>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const failures = new Map<string, number>();
  const running = new Set<string>();
  const paused = new Set<string>();

  function schedule(key: string, delay: number): void {
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void flush(key);
      }, delay),
    );
  }

  function settle(key: string, revision: number): void {
    const next = pending.get(key);
    if (next === undefined) return;
    if (next.revision === revision) pending.delete(key);
    else schedule(key, next.job.delayMs ?? PUBLISH_DEBOUNCE_MS);
  }

  function retry(key: string, err: unknown): void {
    if (err instanceof AccountChangedError || err instanceof NoAccountError) return;
    report('readSync.publish', err);
    if (RATE_LIMITED.test(String(err))) {
      paused.add(key);
      return;
    }
    const attempt = (failures.get(key) ?? 0) + 1;
    failures.set(key, attempt);
    schedule(key, backoffDelay(attempt));
  }

  async function flush(key: string): Promise<void> {
    const current = pending.get(key);
    if (current === undefined || running.has(key) || paused.has(key)) return;
    const { job, revision } = current;
    running.add(key);
    try {
      if (job.accountId !== undefined && !(await isActive(job.accountId))) return;
      await job.send();
      failures.delete(key);
      settle(key, revision);
    } catch (err) {
      retry(key, err);
    } finally {
      running.delete(key);
    }
  }

  return (job: SyncJob): void => {
    pending.set(job.key, { job, revision: (pending.get(job.key)?.revision ?? 0) + 1 });
    failures.delete(job.key);
    schedule(job.key, job.delayMs ?? PUBLISH_DEBOUNCE_MS);
  };
}
