/** Upload + send helpers for the messenger station. */

export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

export async function uploadAttachment(
  daemonUrl: string, token: string, file: Blob, name?: string,
): Promise<Attachment> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': file.type || 'application/octet-stream',
  };
  if (name) headers['X-Filename'] = name;
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/upload`, {
    method: 'POST', headers, body: file,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `upload failed (${res.status})`);
  }
  return await res.json() as Attachment;
}

export async function sendMessenger(
  daemonUrl: string, token: string, text: string, attachments: Attachment[] = [],
): Promise<void> {
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, as: 'user', attachments }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `send failed (${res.status})`);
  }
}

export async function reactMessenger(
  daemonUrl: string, token: string, messageId: string, emoji: string,
): Promise<void> {
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/react`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, emoji, as: 'user' }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `react failed (${res.status})`);
  }
}

export interface HistoryLike { id: string; ts: string; from: string; payload?: unknown }

/** Fold reaction add/remove events into a per-message, per-emoji count. The daemon emits a
 *  `{reactTo, emoji, removed: true}` event when the same sender re-taps the same emoji on the
 *  same target, so we only have to keep the latest event per (msgId, emoji, sender). */
export function reactionsByMessage(events: HistoryLike[]): Map<string, Map<string, number>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let m = out.get(msgId);
    if (!m) { m = new Map(); out.set(msgId, m); }
    m.set(emoji, (m.get(emoji) ?? 0) + 1);
  }
  return out;
}

export function isReaction(e: HistoryLike): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}
