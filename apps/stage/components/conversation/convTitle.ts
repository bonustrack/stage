import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';

export function convTitle(conv: { isGroup: boolean; groupName: string | null; peerAddr: string | null }): string {
  if (conv.isGroup) return conv.groupName === null ? '' : (conv.groupName || 'Untitled group');
  return conv.peerAddr ? (getPeerName(conv.peerAddr) ?? shortAddress(conv.peerAddr)) : '';
}
