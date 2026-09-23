import { getActiveAccount } from './accounts';

export async function withCreateTimeout<C>(
  run: () => Promise<C>, ms: number, message: string, disposeLate?: (value: C) => void,
): Promise<C> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const started = run();
  if (disposeLate) {
    void started.then((value) => { if (timedOut) disposeLate(value); }).catch(() => undefined);
  }
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; reject(new Error(message)); }, ms);
  });
  try {
    return await Promise.race<C>([started, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const STALE_ACCOUNT_MESSAGE = 'The account changed while messaging was starting.';

export async function assertStillActiveAccount(accountId: string, discard: () => void): Promise<void> {
  let activeId: string | null;
  try {
    activeId = (await getActiveAccount())?.id ?? null;
  } catch {
    return;
  }
  if (activeId === accountId) return;
  try { discard(); } catch { }
  throw new Error(STALE_ACCOUNT_MESSAGE);
}

