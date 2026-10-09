import { ignored } from './errorPolicy';
import { linkProxyBase } from './linkProxy';

const UPLOAD_URL = `${linkProxyBase()}/attachments`;
const UPLOAD_TIMEOUT_MS = 60_000;
export const MAX_UPLOAD_BYTES = 100_000_000;

const SWARM_GATEWAY = 'https://download.gateway.ethswarm.org/bzz/';
const SWARM_LINK = /^https:\/\/[^/]+\/bzz\/([0-9a-f]{64}(?:[0-9a-f]{64})?)\/?$/i;

export function attachmentDownloadUrl(url: string): string {
  if (url.startsWith('swarm://')) return `${SWARM_GATEWAY}${url.slice('swarm://'.length).replace(/\/+$/, '')}/`;
  const ref = SWARM_LINK.exec(url)?.[1];
  return ref === undefined ? url : `${SWARM_GATEWAY}${ref.toLowerCase()}/`;
}

export function resolveUploadResponse(
  status: number, body: { id?: string } | null, filename: string,
): string {
  if (status === 413) {
    throw new Error(`Couldn't send "${filename}": the file is too large (413). Try a smaller file.`);
  }
  if (status === 429) {
    throw new Error(`Couldn't send "${filename}": too many uploads right now. Try again in a minute.`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Couldn't send "${filename}": upload failed (${status}).`);
  }
  const id = body?.id;
  if (!id) throw new Error(`Couldn't send "${filename}": the upload service returned no id.`);
  return `${UPLOAD_URL}/${id}`;
}

export function assertUploadSize(bytes: number, filename: string): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Couldn't send "${filename}": the file is too large (over 100 MB). Try a smaller file.`);
  }
}

export async function uploadEncryptedAttachment(payload: Blob, filename: string): Promise<string> {
  assertUploadSize(payload.size, filename);
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: payload,
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    const reason = timedOut ? 'the upload timed out' : 'the upload service could not be reached';
    throw new Error(`Couldn't send "${filename}": ${reason}. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(ignored(null, 'optional')) as { id?: string } | null;
  return resolveUploadResponse(res.status, body, filename);
}
