import { settleWithin } from '@stage-labs/client/timing';

const firstPageLoads = new Set<Promise<unknown>>();
const FIRST_PAGE_WAIT_MS = 3_000;

export function trackFirstPageLoad<T>(load: Promise<T>): Promise<T> {
  firstPageLoads.add(load);
  const done = (): void => {
    firstPageLoads.delete(load);
  };
  void load.then(done, done);
  return load;
}

export async function afterFirstPages(maxMs = FIRST_PAGE_WAIT_MS): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (firstPageLoads.size > 0) {
    const left = deadline - Date.now();
    if (left <= 0) return;
    await settleWithin(Promise.allSettled([...firstPageLoads]), left, []);
  }
}
