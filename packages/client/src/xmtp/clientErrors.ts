export const INSTALLATION_LIMIT_MESSAGE =
  'This wallet already has XMTP set up on too many devices (installation limit reached). ' +
  'Messaging is unavailable for this account — wallet features still work.';

const STORE_CORRUPTION = ['PRAGMA key', 'StorageError', 'incorrect value'];

export function isStoreCorruption(err: unknown, extraSignatures: string[] = []): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return [...STORE_CORRUPTION, ...extraSignatures].some(sig => msg.includes(sig));
}

const INSTALLATION_LIMIT = [
  '10/10',
  'has already registered',
  'already registered',
  'Please revoke existing installations',
  'Cannot register a new installation',
];

export function isInstallationLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INSTALLATION_LIMIT.some(sig => msg.toLowerCase().includes(sig.toLowerCase()));
}

const STALE_KEY_PACKAGE = ['lifetime', 'expired', 'not found', 'no key package'];

export type KeyPackageVerdict = 'reachable' | 'stale-installations' | 'indeterminate';

export function classifyKeyPackageStatuses(
  validationErrors: (string | null | undefined)[],
): KeyPackageVerdict {
  if (validationErrors.length === 0) return 'indeterminate';
  if (validationErrors.some(e => e == null || e === '')) return 'reachable';
  const stale = (e: string): boolean =>
    STALE_KEY_PACKAGE.some(sig => e.toLowerCase().includes(sig));
  return validationErrors.every(e => e != null && stale(e))
    ? 'stale-installations'
    : 'indeterminate';
}

export function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m?.[1] ?? null;
}
