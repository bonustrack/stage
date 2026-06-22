export interface CommonChannel {
  convId: string;
  title: string;
  avatarUri: string | null;
  avatarAddress: string | null;
  memberCount: number;
  lastTs: number | null;
  lastPreview: string;
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  unreadCount: number;
  markedUnread: boolean;
}

export interface CommonChannelRow {
  convId: string;
  peerAddress?: string | null;
  title?: string | null;
  avatarUri?: string | null;
  avatarAddress?: string | null;
  lastTs?: number | null;
  lastPreview?: string | null;
  lastSenderAddress?: string | null;
  lastFromSelf?: boolean;
  unreadCount?: number;
  markedUnread?: boolean;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function commonChannelFromRow(row: CommonChannelRow, members: string[]): CommonChannel {
  const avatarUri = str(row.avatarUri);
  const title = str(row.title);
  return {
    convId: row.convId,
    title: title?.trim() ? title.trim() : 'Group',
    avatarUri,
    avatarAddress: avatarUri ? null : str(row.avatarAddress),
    memberCount: members.length + 1,
    lastTs: typeof row.lastTs === 'number' ? row.lastTs : null,
    lastPreview: str(row.lastPreview) ?? '',
    lastSenderAddress: str(row.lastSenderAddress),
    lastFromSelf: row.lastFromSelf === true,
    unreadCount: typeof row.unreadCount === 'number' ? row.unreadCount : 0,
    markedUnread: row.markedUnread === true,
  };
}

export async function resolveCommonChannels(
  peerAddress: string,
  rows: CommonChannelRow[],
  memberSetOf: (convId: string) => Promise<string[]>,
  archived: Set<string>,
): Promise<CommonChannel[]> {
  const peer = peerAddress.toLowerCase();
  const groups = rows.filter(r => r.peerAddress == null && !archived.has(r.convId));
  const resolved = await Promise.all(
    groups.map(async (row): Promise<CommonChannel | null> => {
      try {
        const members = await memberSetOf(row.convId);
        if (!members.some(a => a.toLowerCase() === peer)) return null;
        return commonChannelFromRow(row, members);
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter((c): c is CommonChannel => c !== null);
}
