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
