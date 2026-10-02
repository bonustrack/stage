import type { MenuItem } from './appIcons';

export function profileDisplayName(
  address: string,
  resolvedName: string | null | undefined,
  shortAddress: string,
): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

export const COPY_ADDRESS_ITEM: MenuItem<'copy-address'> = { id: 'copy-address', label: 'Copy address', icon: 'IconSquareBehindSquare1' };

export const PEER_PROFILE_MENU: MenuItem<'message' | 'send' | 'copy-address'>[] = [
  { id: 'message', label: 'Message', icon: 'IconBubbleAnnotation3' },
  { id: 'send', label: 'Send', icon: 'IconPaperPlane' },
  COPY_ADDRESS_ITEM,
];
