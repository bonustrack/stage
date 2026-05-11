/** GitHub webhook receiver: HMAC-verified, mention-triggered. Bridges to a Discord thread per issue/PR. */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { errMsg, log } from '../log.js';

const MAX_PAYLOAD = 5 * 1024 * 1024;

export type GitHubInbound = {
  /** Stable per issue/PR — `github:owner/repo#42`. */
  scopeKey: string;
  repoFullName: string;
  issueNumber: number;
  title: string;
  /** Body of the triggering comment / issue / PR, with `@<bot>` stripped. */
  text: string;
  authorUsername: string;
  /** True when this is the first time we've seen this scope (issue body / PR body opened with mention). */
  isBootstrap: boolean;
  isPR: boolean;
  /** Link back to the issue or PR. */
  url: string;
};

let onInboundHandler: (m: GitHubInbound) => void = () => {};
export const onInbound = (h: (m: GitHubInbound) => void): void => { onInboundHandler = h; };

type Config = { port: number; secret: string; botUsername: string };
function loadConfig(): Config | null {
  const secret = process.env.GITHUB_WEBHOOK_SECRET, botUsername = process.env.GITHUB_BOT_USERNAME;
  if (!secret || !botUsername) return null;
  return { port: Number(process.env.METRO_GITHUB_PORT ?? 4321), secret, botUsername };
}

export const isConfigured = (): boolean => !!loadConfig();

let server: Server | null = null;

export async function start(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg) { log.info('github webhook: not configured (set GITHUB_WEBHOOK_SECRET + GITHUB_BOT_USERNAME)'); return; }
  server = createServer((req, res) => {
    void handle(req, cfg).then(({ status, body }) => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(body); })
      .catch(err => { log.warn({ err: errMsg(err) }, 'github: handler threw'); res.writeHead(500); res.end(); });
  });
  await new Promise<void>(r => { server!.listen(cfg.port, () => r()); });
  log.info({ port: cfg.port, bot: `@${cfg.botUsername}` }, 'github webhook: listening');
}

export async function stop(): Promise<void> {
  if (!server) return;
  await new Promise<void>(r => { server!.close(() => r()); });
  server = null;
}

async function handle(req: IncomingMessage, cfg: Config): Promise<{ status: number; body: string }> {
  if (req.method !== 'POST' || req.url !== '/webhook') return { status: 404, body: 'not found' };
  const sig = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  if (typeof sig !== 'string' || typeof event !== 'string') return { status: 400, body: 'missing headers' };

  let raw = Buffer.alloc(0);
  for await (const chunk of req) {
    raw = Buffer.concat([raw, chunk as Buffer]);
    if (raw.byteLength > MAX_PAYLOAD) return { status: 413, body: 'too large' };
  }

  const expected = 'sha256=' + createHmac('sha256', cfg.secret).update(raw).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { status: 401, body: 'bad signature' };

  let payload: GitHubPayload;
  try { payload = JSON.parse(raw.toString('utf8')) as GitHubPayload; }
  catch { return { status: 400, body: 'invalid json' }; }

  const inbound = extract(event, payload, cfg.botUsername);
  if (inbound) {
    log.info({ scope: inbound.scopeKey, from: `@${inbound.authorUsername}`, event }, 'github: mention received');
    onInboundHandler(inbound);
  }
  return { status: 200, body: 'ok' };
}

type Repo = { full_name: string };
type Issue = { number: number; title: string; body: string | null; html_url: string; pull_request?: unknown };
type Comment = { body: string | null; html_url: string };
type Sender = { login: string };
type GitHubPayload = { action?: string; sender?: Sender; repository?: Repo; issue?: Issue; comment?: Comment };

/** Issues + issue_comment events cover both Issues and PR top-level comments — PRs are issues under the hood. */
function extract(event: string, p: GitHubPayload, bot: string): GitHubInbound | null {
  const sender = p.sender?.login;
  if (!sender || sender === bot) return null;
  if (event === 'issues' && p.action === 'opened' && p.issue && p.repository) {
    return fromBody(p.issue.body, p.issue, p.repository, sender, bot, true, p.issue.html_url);
  }
  if (event === 'issue_comment' && p.action === 'created' && p.issue && p.repository && p.comment) {
    return fromBody(p.comment.body, p.issue, p.repository, sender, bot, false, p.comment.html_url);
  }
  return null;
}

function fromBody(body: string | null, issue: Issue, repo: Repo, author: string, bot: string, isBootstrap: boolean, url: string): GitHubInbound | null {
  if (!body || !new RegExp(`@${escapeRe(bot)}\\b`, 'i').test(body)) return null;
  const text = body.replace(new RegExp(`@${escapeRe(bot)}\\b`, 'gi'), '').trim();
  if (!text) return null;
  return { scopeKey: `github:${repo.full_name}#${issue.number}`, repoFullName: repo.full_name, issueNumber: issue.number, title: issue.title, text, authorUsername: author, isBootstrap, isPR: !!issue.pull_request, url };
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
