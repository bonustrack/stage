import type { XmtpConsent } from '../../lib/xmtp.types';
import type { GroupAccess } from '../../lib/channelVisibility';

export function canComposeConversation(consent: XmtpConsent | null | undefined, isGroup: boolean, access: GroupAccess): boolean {
  return consent != null && access === 'member' && (!isGroup || consent !== 'denied');
}

export function canApproveConversation(consent: XmtpConsent | null | undefined, isGroup: boolean, access: GroupAccess): boolean {
  return access === 'member' && (consent === 'unknown' || (isGroup && consent === 'denied'));
}
