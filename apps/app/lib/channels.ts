/** Client for the /api/channels endpoints introduced in PR #68. */

export interface Channel {
  line: string;
  members: string[];
  permissions: Record<string, 'admin' | 'write' | 'read'>;
  lastTs: string | null;
}

export async function listChannels(daemonUrl: string, token: string): Promise<Channel[]> {
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `list failed (${res.status})`);
  }
  const data = await res.json() as { channels: Channel[] };
  return data.channels ?? [];
}

export async function createChannel(
  daemonUrl: string, token: string, members: string[],
  permissions?: Record<string, 'admin' | 'write' | 'read'>,
): Promise<Channel> {
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/channels`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ members, ...(permissions ? { permissions } : {}) }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `create failed (${res.status})`);
  }
  return await res.json() as Channel;
}

/** Pretty short id for display — `metro://messenger/channel/aBcD…` → `aBcD…`. */
export function channelShortId(line: string): string {
  const m = line.match(/^metro:\/\/messenger\/channel\/(.+)$/);
  return m ? m[1] : line;
}

/** Best-effort short label for a wallet/agent URI displayed in channel-list rows. */
export function shortMember(uri: string): string {
  const m = uri.match(/^metro:\/\/user\/eth\/(0x[a-f0-9]{40})$/i);
  if (m) return `${m[1].slice(0, 6)}…${m[1].slice(-4)}`;
  return uri.replace(/^metro:\/\//, '');
}
