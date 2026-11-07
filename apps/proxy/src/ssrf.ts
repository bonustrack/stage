import { hostProblem } from '@stage-labs/client/net/publicHost';
import { readCappedBytes, type CapMode } from '@stage-labs/client/net/cappedBody';
import { STAGE_HOST } from '@stage-labs/client/endpoints';

export const UA = 'Mozilla/5.0 (compatible; StageLinkPreview/1.0; +https://stage.box)';

const BLOCKED_DOMAINS = [STAGE_HOST, 'metadata.google.internal'];

export class SsrfError extends Error {}

export async function readCappedText(res: Response, maxBytes: number, mode: CapMode = 'truncate'): Promise<string | null> {
  const bytes = await readCappedBytes(res.body, maxBytes, mode);
  return bytes === null ? null : new TextDecoder('utf-8').decode(bytes);
}

export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError('invalid url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new SsrfError('only http(s) urls are allowed');
  if (!u.hostname) throw new SsrfError('missing host');
  const problem = hostProblem(u.hostname, { blockedDomains: BLOCKED_DOMAINS });
  if (problem === 'private-ip') throw new SsrfError('private ip not allowed');
  if (problem !== null) throw new SsrfError('blocked host');
  return u;
}

interface PublicFetchOptions {
  maxRedirects: number;
  timeoutMs: number;
  headers: (url: string) => HeadersInit;
  cf?: RequestInit['cf'];
}

interface PublicFetchResult {
  res: Response;
  finalUrl: string;
}

export async function fetchPublic(rawUrl: string, opts: PublicFetchOptions): Promise<PublicFetchResult> {
  let current = assertPublicUrl(rawUrl).toString();
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: opts.headers(current),
      ...(opts.cf ? { cf: opts.cf } : {}),
    });
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!loc) return { res, finalUrl: current };
    current = assertPublicUrl(new URL(loc, current).toString()).toString();
  }
  throw new SsrfError('too many redirects');
}
