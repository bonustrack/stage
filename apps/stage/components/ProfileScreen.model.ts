import type { MenuItem } from './appIcons';

export function profileDisplayName(address: string, resolvedName: string | null | undefined, shortAddress: string): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

export const COPY_ADDRESS_ITEM: MenuItem<'copy-address'> = { id: 'copy-address', label: 'Copy address', icon: 'IconSquareBehindSquare1' };

const SEND_ITEM: MenuItem<'send'> = { id: 'send', label: 'Send', icon: 'IconPaperPlane' };

export function peerProfileMenu(wallet: boolean): MenuItem<'message' | 'send' | 'copy-address'>[] {
  return [{ id: 'message', label: 'Message', icon: 'IconBubbleAnnotation3' }, ...(wallet ? [SEND_ITEM] : []), COPY_ADDRESS_ITEM];
}
