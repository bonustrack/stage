import { dbDirFor } from '../accounts/registry';

export function webXmtpDbPath(accountId: string, env: string): string {
  return `${dbDirFor(accountId)}-${env}.db3`;
}

export function canReuseSavedClient(
  savedAddress: string | null,
  savedEnv: string | null,
  address: string,
  env: string,
): boolean {
  return savedAddress?.toLowerCase() === address && savedEnv === env;
}

export function installationCreatedAtMs(clientTimestampNs: bigint | null | undefined): number | null {
  return clientTimestampNs != null ? Number(clientTimestampNs / 1_000_000n) : null;
}

export type SavedClientFallback = 'build-failed' | 'unregistered';

export interface SavedClientDeps<C> {
  reusable: boolean;
  build: () => Promise<C>;
  isRegistered: (client: C) => Promise<boolean>;
  close: (client: C) => void;
  create: () => Promise<C>;
  onFallback?: (reason: SavedClientFallback, error?: unknown) => void;
}

export interface OpenedClient<C> { client: C; created: boolean }

export async function openSavedClient<C>(deps: SavedClientDeps<C>): Promise<OpenedClient<C>> {
  if (deps.reusable) {
    let built: C | null = null;
    try { built = await deps.build(); } catch (e) { deps.onFallback?.('build-failed', e); }
    if (built !== null) {
      if (await deps.isRegistered(built).catch(() => false)) return { client: built, created: false };
      deps.onFallback?.('unregistered');
      try { deps.close(built); } catch { }
    }
  }
  return { client: await deps.create(), created: true };
}
