import { PROXY_ROUTES } from '../endpoints';
import { NODE_CODE_MAX_BYTES, NODE_PUBLISH_STATUS, hostedNodeUrl, nodeIdOf } from './hosting';
import { nodeHeaders, nodeKeyId } from './protocol';

const PUBLISH_TIMEOUT_MS = 30_000;
const DETAIL_MAX_CHARS = 300;

export type PublishProblem = 'too-large' | 'refused' | 'busy' | 'full' | 'not-ready' | 'unreachable' | 'failed';

export type PublishResult = { ok: true; url: string } | { ok: false; problem: PublishProblem; detail?: string };

type PublishMethod = 'PUT' | 'DELETE';

const STATUS_PROBLEMS: ReadonlyMap<number, PublishProblem> = new Map(
  (Object.keys(NODE_PUBLISH_STATUS) as (keyof typeof NODE_PUBLISH_STATUS)[]).map((problem) => [NODE_PUBLISH_STATUS[problem], problem]),
);

export function ownNodeUrl(key: string): string | null {
  const id = nodeIdOf(nodeKeyId(key));
  return id === null ? null : hostedNodeUrl(id);
}

export function nodeCodeTooLarge(code: string): boolean {
  return new TextEncoder().encode(code).byteLength > NODE_CODE_MAX_BYTES;
}

async function call(method: PublishMethod, proxyBase: string, key: string, body: string): Promise<Response | null> {
  const url = `${proxyBase}${PROXY_ROUTES.nodes}`;
  const headers: Record<string, string> = nodeHeaders(method, url, body, key, Date.now());
  if (body !== '') headers['Content-Type'] = 'application/javascript';
  try {
    return await fetch(url, {
      method,
      headers,
      body: body === '' ? undefined : body,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error.slice(0, DETAIL_MAX_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

export async function publishNode(proxyBase: string, key: string, code: string): Promise<PublishResult> {
  const url = ownNodeUrl(key);
  if (url === null) return { ok: false, problem: 'failed' };
  if (code.trim() === '') return { ok: false, problem: 'refused' };
  if (nodeCodeTooLarge(code)) return { ok: false, problem: 'too-large' };
  const response = await call('PUT', proxyBase, key, code);
  if (response === null) return { ok: false, problem: 'unreachable' };
  if (response.ok) return { ok: true, url };
  const problem = STATUS_PROBLEMS.get(response.status) ?? 'failed';
  return problem === 'refused' ? { ok: false, problem, detail: await errorDetail(response) } : { ok: false, problem };
}

export async function deleteNode(proxyBase: string, key: string): Promise<boolean> {
  const response = await call('DELETE', proxyBase, key, '');
  return response !== null && (response.ok || response.status === 404);
}
