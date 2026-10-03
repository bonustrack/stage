export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function errorLine(e: unknown, fallback = String(e)): string {
  return e instanceof Error ? e.message.split('\n')[0] ?? fallback : fallback;
}
