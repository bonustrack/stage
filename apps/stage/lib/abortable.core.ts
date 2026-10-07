export function abortable<T>(
  work: Promise<T>, signal: AbortSignal, disposeLate?: (value: T) => void, reportLate?: (error: unknown) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let aborted = false;
    const cancel = (): void => { aborted = true; reject(signal.reason instanceof Error ? signal.reason : new Error('Operation cancelled')); };
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
    void work.then(value => {
      signal.removeEventListener('abort', cancel);
      if (aborted) disposeLate?.(value);
      else resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener('abort', cancel);
      if (aborted) reportLate?.(error);
      else reject(error instanceof Error ? error : new Error('Operation failed', { cause: error }));
    });
  });
}
