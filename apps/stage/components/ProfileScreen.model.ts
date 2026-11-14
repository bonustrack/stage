import type { MenuItem } from './appIcons';

export function profileDisplayName(address: string, resolvedName: string | null | undefined, shortAddress: string): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

export const COPY_ADDRESS_ITEM: MenuItem<'copy-address'> = { id: 'copy-address', label: 'Copy address', icon: 'IconSquareBehindSquare1' };

const SEND_ITEM: MenuItem<'send'> = { id: 'send', label: 'Send', icon: 'IconPaperPlane' };

type PeerMenuId = 'message' | 'send' | 'copy-address' | 'report' | 'block' | 'unblock';

const REPORT_ITEM: MenuItem<'report'> = { id: 'report', label: 'Report', icon: 'IconFlag1' };

function blockItem(blocked: boolean | null): MenuItem<'block' | 'unblock'>[] {
  if (blocked === null) return [];
  return [
    blocked
      ? { id: 'unblock', label: 'Unblock', icon: 'IconCircleBanSign' }
      : { id: 'block', label: 'Block', icon: 'IconCircleBanSign', danger: true },
  ];
}

export function peerProfileMenu(wallet: boolean, blocked: boolean | null): MenuItem<PeerMenuId>[] {
  return [
    { id: 'message', label: 'Message', icon: 'IconBubbleAnnotation3' },
    ...(wallet ? [SEND_ITEM] : []),
    COPY_ADDRESS_ITEM,
    REPORT_ITEM,
    ...blockItem(blocked),
  ];
}
