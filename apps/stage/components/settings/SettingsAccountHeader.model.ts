export const HEADER_AVATAR_SIZE = 48;

export function accountDisplayName(peerName: string | null | undefined, label: string | undefined, fallback: string): string {
  const candidate = peerName ?? label;
  return candidate !== undefined && candidate !== null && candidate.trim() !== '' ? candidate : fallback;
}

export function accountSubtitle(name: string, short: string): string {
  return name === short ? 'View profile' : short;
}
