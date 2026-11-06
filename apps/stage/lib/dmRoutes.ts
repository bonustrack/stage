import { NO_ROUTES, dmRowId, routeOf, withRoute, type ConvRoutes } from '@stage-labs/client/xmtp/dmRoutes';
import { isImportReplay } from '@stage-labs/client/xmtp/historyImport';
import { createValueStore } from './persistedStore';
import { reported } from './errorPolicy';
import { storedRecordOf } from './storeCore';

const isRoute = (value: unknown): value is string => typeof value === 'string';

function parseNs(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const routes = createValueStore<ConvRoutes>({
  key: 'xmtp.dmRoutes.',
  default: NO_ROUTES,
  schema: storedRecordOf(isRoute),
  perAccount: true,
});
const importedUntil = createValueStore<number>({ key: 'xmtp.importedUntilNs.', default: 0, deserialize: parseNs, perAccount: true });

export function dmRoutesReady(): Promise<void> {
  return Promise.all([routes.load(), importedUntil.load()]).then(() => undefined);
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
