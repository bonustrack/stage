import type { AppIconName } from './appIcons';

export function profileDisplayName(
  address: string,
  resolvedName: string | null | undefined,
  shortAddress: string,
): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

type ProfileMenuId = 'message' | 'send' | 'copy-address';

interface ProfileMenuItem { id: ProfileMenuId; label: string; icon: AppIconName }

export const PEER_PROFILE_MENU: ProfileMenuItem[] = [
  { id: 'message', label: 'Message', icon: 'IconBubbleDots' },
  { id: 'send', label: 'Send', icon: 'IconPaperPlane' },
  { id: 'copy-address', label: 'Copy address', icon: 'IconSquareBehindSquare1' },
];
