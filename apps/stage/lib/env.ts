export function envString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function envBaseUrl(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value.replace(/\/$/, '') : fallback;
}
