export type ConvRoutes = Readonly<Record<string, string>>;

export const NO_ROUTES: ConvRoutes = {};

export function routeOf(routes: ConvRoutes, convId: string): string {
  const seen = new Set<string>();
  let current = convId;
  for (let next = routes[current]; next !== undefined && !seen.has(next); next = routes[current]) {
    seen.add(current);
    current = next;
  }
  return current;
}

export function withRoute(routes: ConvRoutes, from: string, to: string): ConvRoutes {
  const target = routeOf(routes, to);
  if (target === from || routeOf(routes, from) === target) return routes;
  return { ...routes, [from]: target };
}

export interface DmRowRef {
  convId: string;
  peerAddress: string | null;
}

export function dmIdsByPeer(rows: readonly DmRowRef[]): ReadonlyMap<string, string> {
  const byPeer = new Map<string, string>();
  for (const row of rows) {
    const peer = row.peerAddress?.toLowerCase();
    if (peer && !byPeer.has(peer)) byPeer.set(peer, row.convId);
  }
  return byPeer;
}

export interface DmRowId {
  rowId: string;
  route: { from: string; to: string } | null;
}

export function dmRowId(
  routes: ConvRoutes, convId: string, peerAddress: string | null, knownByPeer: ReadonlyMap<string, string>,
): DmRowId {
  const routed = routeOf(routes, convId);
  if (routed !== convId || peerAddress === null) return { rowId: routed, route: null };
  const known = knownByPeer.get(peerAddress.toLowerCase());
  if (known === undefined || known === convId) return { rowId: convId, route: null };
  return { rowId: known, route: { from: convId, to: known } };
}

export function uniqueByConvId<R extends { convId: string }>(rows: readonly R[]): R[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.convId)) return false;
    seen.add(row.convId);
    return true;
  });
}

export function isImportReplay(sentNs: number, importedUntilNs: number): boolean {
  return importedUntilNs > 0 && sentNs > 0 && sentNs <= importedUntilNs;
}
