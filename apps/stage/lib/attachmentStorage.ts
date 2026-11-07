import { ignored } from './errorPolicy';
import { linkProxyBase } from './linkProxy';
import { FetchTimeoutError, fetchWithin } from '@stage-labs/client/timing';
import { PROXY_ROUTES } from '@stage-labs/client/endpoints';
import { UPLOAD_MAX_BYTES, UPLOAD_REPLY } from '@stage-labs/client/uploads';

const UPLOAD_URL = `${linkProxyBase()}${PROXY_ROUTES.attachments}`;
const UPLOAD_TIMEOUT_MS = 60_000;
export const MAX_UPLOAD_BYTES = UPLOAD_MAX_BYTES;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1_000_000;

const SWARM_GATEWAY = 'https://download.gateway.ethswarm.org/bzz/';
const SWARM_LINK = /^https:\/\/[^/]+\/bzz\/([0-9a-f]{64}(?:[0-9a-f]{64})?)\/?$/i;

export function attachmentDownloadUrl(url: string): string {
  if (url.startsWith('swarm://')) return `${SWARM_GATEWAY}${url.slice('swarm://'.length).replace(/\/+$/, '')}/`;
  const ref = SWARM_LINK.exec(url)?.[1];
  return ref === undefined ? url : `${SWARM_GATEWAY}${ref.toLowerCase()}/`;
}

export function resolveUploadResponse(status: number, body: unknown, filename: string): string {
  if (status === 413) {
    throw new Error(`Couldn't send "${filename}": the file is too large (413). Try a smaller file.`);
  }
  if (status === 429) {
    throw new Error(`Couldn't send "${filename}": too many uploads right now. Try again in a minute.`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Couldn't send "${filename}": upload failed (${status}).`);
  }
  const id = UPLOAD_REPLY.safeParse(body).data?.id;
  if (id === undefined) throw new Error(`Couldn't send "${filename}": the upload service returned no id.`);
  return `${UPLOAD_URL}/${id}`;
}

export function assertUploadSize(bytes: number, filename: string): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Couldn't send "${filename}": the file is too large (over ${MAX_UPLOAD_MB} MB). Try a smaller file.`);
  }
}

export async function uploadEncryptedAttachment(payload: Blob, filename: string): Promise<string> {
  assertUploadSize(payload.size, filename);
  let res: Response;
  try {
    res = await fetchWithin(
      UPLOAD_URL,
      { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: payload },
      { timeoutMs: UPLOAD_TIMEOUT_MS },
    );
  } catch (e) {
    const reason = e instanceof FetchTimeoutError ? 'the upload timed out' : 'the upload service could not be reached';
    throw new Error(`Couldn't send "${filename}": ${reason}. Check your connection and try again.`);
  }
  const body: unknown = await res.json().catch(ignored(null, 'optional'));
  return resolveUploadResponse(res.status, body, filename);
}
