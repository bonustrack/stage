
const RAW_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_SWARMY_KEY: process.env.EXPO_PUBLIC_SWARMY_KEY as string | undefined,
};

function envString(name: string): string | undefined {
  const value = RAW_ENV[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Uploads authenticate with EXPO_PUBLIC_SWARMY_KEY (inlined at web build time).
const SWARMY_UPLOAD_URL = 'https://api.swarmy.cloud/api/files';
const SWARMY_UPLOAD_TIMEOUT_MS = 60_000;

export const SWARM_GATEWAY = 'https://api.swarmy.cloud/bzz/';
export const SWARM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function swarmToHttp(url: string): string {
  if (!url.startsWith('swarm://')) return url;
  const ref = url.slice('swarm://'.length).replace(/\/+$/, '');
  return `${SWARM_GATEWAY}${ref}/`;
}

function swarmyKey(): string | undefined {
  return envString('EXPO_PUBLIC_SWARMY_KEY');
}

export function tooLargeError(filename: string): Error {
  const mb = (SWARM_UPLOAD_MAX_BYTES / (1024 * 1024)).toFixed(0);
  return new Error(`"${filename}" is too large to send (max ~${mb}MB). Try a smaller file.`);
}

export function resolveSwarmyResponse(
  status: number, body: { swarmReference?: string } | null, filename: string,
): string {
  if (status === 413) {
    throw new Error(`"${filename}" is too large to send (server max ~1MB). Try a smaller file.`);
  }
  if (status === 401 || status === 403) {
    throw new Error(`Couldn't send "${filename}" — the upload service rejected the request.`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Couldn't send "${filename}" — upload failed (${status}).`);
  }
  const ref = body?.swarmReference;
  if (!ref) throw new Error(`Couldn't send "${filename}" — the upload service returned no reference.`);
  return `${SWARM_GATEWAY}${ref}/`;
}

export async function uploadFormToSwarmy(form: FormData, filename: string): Promise<string> {
  const key = swarmyKey();
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
    throw new Error(`Couldn't send "${filename}" — ${reason}. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null) as { swarmReference?: string } | null;
  return resolveSwarmyResponse(res.status, body, filename);
}
