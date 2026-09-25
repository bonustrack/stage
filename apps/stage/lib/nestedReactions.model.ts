export function withNestedReactions<M>(
  newestFirst: readonly M[],
  reactionsOf: (m: M) => readonly M[],
  sentNsOf: (m: M) => number,
): M[] {
  const pending = newestFirst
    .flatMap((m) => reactionsOf(m).map((r) => ({ r, ns: Math.max(sentNsOf(r), sentNsOf(m)) })))
    .sort((a, b) => b.ns - a.ns);
  return newestFirst.flatMap((m) => {
    const cut = pending.findIndex((p) => p.ns < sentNsOf(m));
    return [...pending.splice(0, cut === -1 ? pending.length : cut).map((p) => p.r), m];
  });
}
