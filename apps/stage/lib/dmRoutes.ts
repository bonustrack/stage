import {
  NO_ROUTES, dmRowId, isImportReplay, routeOf, withRoute, type ConvRoutes,
} from '@stage-labs/client/xmtp/dmRoutes';
import { makeAccountValue } from './accountValue';
import { reported } from './errorPolicy';

function parseRoutes(raw: string): ConvRoutes {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return NO_ROUTES;
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch {
    return NO_ROUTES;
  }
}

function parseNs(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const routes = makeAccountValue<ConvRoutes>('xmtp.dmRoutes.', NO_ROUTES, parseRoutes, (v) => JSON.stringify(v));
const importedUntil = makeAccountValue<number>('xmtp.importedUntilNs.', 0, parseNs, String);

export function dmRoutesReady(): Promise<void> {
  return Promise.all([routes.ready(), importedUntil.ready()]).then(() => undefined);
}

export function routeConvId(convId: string): string {
  return routeOf(routes.get(), convId);
}

export function registerDmRoute(from: string, to: string): void {
  void routes.update((current) => withRoute(current, from, to)).catch(reported('dmRoutes.register'));
}

export function dmRowIdOf(convId: string, peerAddress: string | null, knownByPeer: ReadonlyMap<string, string>): string {
  const { rowId, route } = dmRowId(routes.get(), convId, peerAddress, knownByPeer);
  if (route) registerDmRoute(route.from, route.to);
  return rowId;
}

export function markHistoryImported(nowMs: number): Promise<void> {
  const ns = nowMs * 1_000_000;
  return importedUntil.update((current) => Math.max(current, ns));
}

export function isImportedReplay(sentNs: number): boolean {
  return isImportReplay(sentNs, importedUntil.get());
}
