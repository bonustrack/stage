export function profileDisplayName(
  address: string,
  resolvedName: string | null | undefined,
  shortAddress: string,
): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}
