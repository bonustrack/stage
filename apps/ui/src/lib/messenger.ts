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
