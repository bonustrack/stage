export function nextHdIndex(usedIndices: readonly number[], highWater: number | null): number {
  const maxUsed = usedIndices.reduce((max, i) => (Number.isInteger(i) && i > max ? i : max), -1);
  return Math.max(maxUsed + 1, highWater ?? 0);
}
