/** Upload + send helpers for the messenger station. Mirrors apps/ui/src/lib/messenger.ts. */

export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

/** RN-compatible: file:// URI → fetch → blob → POST raw binary. */
export async function uploadAttachment(
  daemonUrl: string, token: string, uri: string, mime: string, name?: string,
): Promise<Attachment> {
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': mime || 'application/octet-stream',
  };
  if (name) headers['X-Filename'] = name;
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/upload`, {
    method: 'POST', headers, body: blob,
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

export interface HistoryLike { id: string; from: string; payload?: unknown }
export function reactionsByMessage(events: HistoryLike[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string } | undefined;
    if (!p?.reactTo || !p.emoji) continue;
    const bucket = out.get(p.reactTo) ?? new Map<string, number>();
    bucket.set(p.emoji, (bucket.get(p.emoji) ?? 0) + 1);
    out.set(p.reactTo, bucket);
  }
  return out;
}

export function isReaction(e: HistoryLike): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}
