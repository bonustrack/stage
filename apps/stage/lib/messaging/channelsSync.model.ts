export function mergePaintedRows<R extends { convId: string; lastTs: number | null }>(
  beforeIds: readonly string[],
  current: readonly R[] | null,
  painted: readonly R[],
): R[] {
  const before = new Set(beforeIds);
  const now = new Set((current ?? []).map((r) => r.convId));
  const paintedIds = new Set(painted.map((r) => r.convId));
  const addedMeanwhile = (current ?? []).filter((r) => !before.has(r.convId) && !paintedIds.has(r.convId));
  const kept = painted.filter((r) => now.has(r.convId) || !before.has(r.convId));
  return [...addedMeanwhile, ...kept].sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
}

export function visibleRowsDiff(rowIds: readonly string[], visibleIds: readonly string[]): { added: string[]; gone: string[] } {
  const rows = new Set(rowIds);
  const visible = new Set(visibleIds);
  return { added: visibleIds.filter((id) => !rows.has(id)), gone: rowIds.filter((id) => !visible.has(id)) };
}
