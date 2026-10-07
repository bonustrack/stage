export function makePushRetry(schedule: (run: () => void, delay: number) => () => void) {
  const pending = new Map<string, { attempts: number; cancel: (() => void) | null }>();
  function success(id: string): void {
    pending.get(id)?.cancel?.();
    pending.delete(id);
  }
  function clear(): void { for (const id of pending.keys()) success(id); }
  function failed(id: string, run: () => void): void {
    const previous = pending.get(id);
    if (previous?.cancel) return;
    const attempts = (previous?.attempts ?? 0) + 1;
    const entry = { attempts, cancel: null as (() => void) | null };
    pending.set(id, entry);
    entry.cancel = schedule(() => { entry.cancel = null; run(); }, Math.min(5_000 * 2 ** (attempts - 1), 60_000));
  }
  return { failed, success, clear };
}
