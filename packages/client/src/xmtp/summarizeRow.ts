import { shortAddress } from '../identity/format';

export interface UnreadCountEntry {
  sentNs?: number;
  senderInboxId?: string;
}

export interface RowMessage {
  content: unknown;
  contentTypeId: string | undefined;
  senderInboxId: string;
  sentNs: number;
}

export function countUnreadEntries(
  entries: readonly UnreadCountEntry[],
  lastReadNs: number,
  selfInboxId: string,
): number {
  let unreadCount = 0;
  for (const m of entries) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return unreadCount;
}

export interface ChannelRowTitleInputs {
  peerAddress: string | null;
  groupName: string;
  memberCount: number;
  fallbackId: string;
}

export function channelRowTitle(i: ChannelRowTitleInputs): string {
  if (i.peerAddress) return shortAddress(i.peerAddress);
  const name = i.groupName.trim();
  if (name) return name;
  if (i.memberCount > 0) {
    const total = i.memberCount + 1;
    return `${total} member${total === 1 ? '' : 's'}`;
  }
  return i.fallbackId.slice(0, 12);
}

export interface InitialMarkedUnreadInputs {
  lastReadNs: number;
  unreadCount: number;
  hasLast: boolean;
  lastFromSelf: boolean;
  consentUnknown?: boolean;
}

export function initialMarkedUnread(i: InitialMarkedUnreadInputs): boolean {
  return (
    (i.consentUnknown ?? true)
    && i.lastReadNs === 0
    && i.unreadCount === 0
    && i.hasLast
    && !i.lastFromSelf
  );
}
