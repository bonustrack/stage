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
