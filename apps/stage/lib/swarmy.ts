import { ignored } from './errorPolicy';
import { envString } from './env';

const SWARMY_KEY = envString(process.env.EXPO_PUBLIC_SWARMY_KEY);

const SWARMY_UPLOAD_URL = 'https://api.swarmy.cloud/api/files';
const SWARMY_UPLOAD_TIMEOUT_MS = 60_000;

export const SWARM_GATEWAY = 'https://api.swarmy.cloud/bzz/';

export function swarmToHttp(url: string): string {
  if (!url.startsWith('swarm://')) return url;
  const ref = url.slice('swarm://'.length).replace(/\/+$/, '');
  return `${SWARM_GATEWAY}${ref}/`;
}

const SWARM_FALLBACK_GATEWAY = 'https://download.gateway.ethswarm.org/bzz/';
const SWARMY_BZZ_REF = /^https:\/\/api\.swarmy\.cloud\/bzz\/([0-9a-f]{64}(?:[0-9a-f]{64})?)\/?$/i;

export function swarmDownloadUrls(url: string): string[] {
  const primary = swarmToHttp(url);
  const ref = SWARMY_BZZ_REF.exec(primary)?.[1];
  return ref === undefined ? [primary] : [primary, `${SWARM_FALLBACK_GATEWAY}${ref}/`];
}

export async function fromFirstUrl<T>(urls: readonly string[], load: (url: string) => Promise<T>): Promise<T> {
  let failure: unknown = new Error('No download url.');
  for (const url of urls) {
    try {
      return await load(url);
    } catch (err) {
      failure = err;
    }
  }
  throw failure;
}

export function resolveSwarmyResponse(
  status: number, body: { swarmReference?: string } | null, filename: string,
): string {
  if (status === 413) {
    throw new Error(`Couldn't send "${filename}": the upload service rejected the file size (413). Try a smaller file.`);
  }
  if (status === 401 || status === 403) {
    throw new Error(`Couldn't send "${filename}": the upload service rejected the request.`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Couldn't send "${filename}": upload failed (${status}).`);
  }
  const ref = body?.swarmReference;
  if (!ref) throw new Error(`Couldn't send "${filename}": the upload service returned no reference.`);
  return `${SWARM_GATEWAY}${ref}/`;
}

export async function uploadFormToSwarmy(form: FormData, filename: string): Promise<string> {
  const key = SWARMY_KEY;
  if (!key) {
    throw new Error('Attachment upload is not configured (missing EXPO_PUBLIC_SWARMY_KEY).');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, SWARMY_UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(SWARMY_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    const reason = timedOut ? 'the upload timed out' : 'the upload service could not be reached';
    throw new Error(`Couldn't send "${filename}": ${reason}. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(ignored(null, 'optional')) as { swarmReference?: string } | null;
  return resolveSwarmyResponse(res.status, body, filename);
}
