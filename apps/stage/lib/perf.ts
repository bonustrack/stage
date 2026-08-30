export function perfLog(label: string, extra?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[perf +${Math.round(performance.now())}ms] ${label}`, extra ?? '');
}

export async function perfTime<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let outcome = 'ok';
  try {
    return await fn();
  } catch (e) {
    outcome = `threw: ${e instanceof Error ? e.message : String(e)}`;
    throw e;
  } finally {
    perfLog(label, { ms: Math.round(performance.now() - started), outcome });
  }
}
