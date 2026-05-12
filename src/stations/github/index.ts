/** GitHub station: receives event dispatches from a GitHub Action workflow; replies via REST. */

import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { errMsg, log } from '../../log.js';
import * as Line from '../line.js';
import type { Capabilities, ChatStation, InboundMessage, Line as LineT, SendOpts } from '../types.js';

const MAX_PAYLOAD = 5 * 1024 * 1024;
const API_BASE = 'https://api.github.com';

export type GitHubMeta = {
  isPR: boolean;
  title: string;
  url: string;
  authorUsername: string;
  repoFullName: string;
  issueNumber: number;
};

export const CAPABILITIES: Capabilities = { in: ['text'], out: ['text'], features: ['edit'] };

type Config = { port: number; token: string; botUsername: string };

const targetOf = (line: LineT): { owner: string; repo: string; number: number } => {
  const t = Line.parseGithub(line);
  if (!t) throw new Error(`not a github line: ${line}`);
  return t;
};

async function gh<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set — cannot post to github');
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'metro',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`github ${method} ${path}: ${res.status} ${t}`); }
  return (await res.json()) as T;
}

export class GitHubStation implements ChatStation<GitHubMeta> {
  readonly name = 'github';
  readonly capabilities = CAPABILITIES;

  private server: Server | null = null;
  private messageHandler: (m: InboundMessage<GitHubMeta>) => void = () => {};

  onMessage(handler: (m: InboundMessage<GitHubMeta>) => void): void { this.messageHandler = handler; }
  /** GitHub has no live stop UI; no-op subscriber. */
  onStop(_handler: (id: string) => Promise<boolean>): void { /* no-op */ }

  isConfigured(): boolean { return !!this.loadConfig(); }

  async start(): Promise<void> {
    const cfg = this.loadConfig();
    if (!cfg) { log.info('github station: not configured (set METRO_TOKEN + GITHUB_BOT_USERNAME + GITHUB_TOKEN)'); return; }
    this.server = createServer((req, res) => {
      void this.handle(req, cfg).then(({ status, body }) => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(body); })
        .catch(err => { log.warn({ err: errMsg(err) }, 'github: handler threw'); res.writeHead(500); res.end(); });
    });
    await new Promise<void>(r => { this.server!.listen(cfg.port, () => r()); });
    log.info({ port: cfg.port, bot: `@${cfg.botUsername}` }, 'github station: listening for /dispatch');
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>(r => { this.server!.close(() => r()); });
    this.server = null;
  }

  async send(line: LineT, text: string, _opts?: SendOpts): Promise<string> {
    const { owner, repo, number } = targetOf(line);
    const r = await gh<{ id: number }>('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, { body: text });
    return String(r.id);
  }

  async edit(line: LineT, messageId: string, text: string, _opts?: SendOpts): Promise<void> {
    const { owner, repo } = targetOf(line);
    await gh('PATCH', `/repos/${owner}/${repo}/issues/comments/${messageId}`, { body: text });
  }

  private loadConfig(): Config | null {
    const token = process.env.METRO_TOKEN, botUsername = process.env.GITHUB_BOT_USERNAME;
    if (!token || !botUsername) return null;
    return { port: Number(process.env.METRO_PORT ?? 4321), token, botUsername };
  }

  private async handle(req: IncomingMessage, cfg: Config): Promise<{ status: number; body: string }> {
    if (req.method !== 'POST' || req.url !== '/dispatch') return { status: 404, body: 'not found' };
    const token = req.headers['x-metro-token'];
    const event = req.headers['x-github-event'];
    if (typeof token !== 'string' || typeof event !== 'string') return { status: 400, body: 'missing headers' };
    const given = Buffer.from(token), expected = Buffer.from(cfg.token);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { status: 401, body: 'bad token' };

    let raw = Buffer.alloc(0);
    for await (const chunk of req) {
      raw = Buffer.concat([raw, chunk as Buffer]);
      if (raw.byteLength > MAX_PAYLOAD) return { status: 413, body: 'too large' };
    }

    let payload: GitHubPayload;
    try { payload = JSON.parse(raw.toString('utf8')) as GitHubPayload; }
    catch { return { status: 400, body: 'invalid json' }; }

    const inbound = extract(event, payload, cfg.botUsername);
    if (inbound) {
      log.info({ line: inbound.line, from: `@${inbound.meta.authorUsername}`, event }, 'github: mention received');
      this.messageHandler(inbound);
    }
    return { status: 200, body: 'ok' };
  }
}

type Repo = { full_name: string };
type IssueLike = { number: number; title: string; body: string | null; html_url: string };
type GitHubPayload = {
  action?: string; sender?: { login: string }; repository?: Repo;
  issue?: IssueLike & { pull_request?: unknown };
  pull_request?: IssueLike;
  comment?: { body: string | null; html_url: string };
};

/** Maps an event payload to `(body, url, issue-or-pr metadata)`. Returns null for unhandled events / non-mentions. */
function extract(event: string, p: GitHubPayload, bot: string): InboundMessage<GitHubMeta> | null {
  const sender = p.sender?.login;
  if (!sender || sender === bot || !p.repository) return null;
  const r = pickSource(event, p);
  if (!r) return null;
  if (!r.body || !new RegExp(`@${escapeRe(bot)}\\b`, 'i').test(r.body)) return null;
  const text = r.body.replace(new RegExp(`@${escapeRe(bot)}\\b`, 'gi'), '').trim();
  if (!text) return null;
  const [owner, repoName] = p.repository.full_name.split('/');
  return {
    station: 'github', line: Line.github(owner, repoName, r.isPR, r.number),
    lineName: r.title, messageId: r.url, text, attachments: [], mentionsBot: true,
    meta: { isPR: r.isPR, title: r.title, url: r.url, authorUsername: sender, repoFullName: p.repository.full_name, issueNumber: r.number },
  };
}

function pickSource(event: string, p: GitHubPayload): { body: string | null; url: string; number: number; title: string; isPR: boolean } | null {
  if (event === 'issues' && p.action === 'opened' && p.issue)
    return { body: p.issue.body, url: p.issue.html_url, number: p.issue.number, title: p.issue.title, isPR: false };
  if (event === 'issue_comment' && p.action === 'created' && p.issue && p.comment)
    return { body: p.comment.body, url: p.comment.html_url, number: p.issue.number, title: p.issue.title, isPR: !!p.issue.pull_request };
  if (event === 'pull_request' && p.action === 'opened' && p.pull_request)
    return { body: p.pull_request.body, url: p.pull_request.html_url, number: p.pull_request.number, title: p.pull_request.title, isPR: true };
  return null;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
