// Claude Code agent adapter. Spawns `claude -p --output-format stream-json
// --include-partial-messages --verbose` per turn, parses the line-delimited
// JSON event stream, and exposes the same `Agent` surface as codex.ts.
//
// Unlike codex (long-running app-server daemon), Claude Code has no daemon
// mode — each turn is a fresh subprocess. Session continuity is achieved
// by passing the same uuid via `--session-id` for the first turn and
// `--resume` for every subsequent turn.

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { errMsg, log } from '../log.js';
import type { Agent, AgentTurnCallbacks } from './types.js';

export class ClaudeAgent implements Agent {
  // Threads that have had at least one turn run (so `--session-id` was
  // already consumed and subsequent turns must use `--resume`).
  private started = new Set<string>();
  private children = new Set<ChildProcess>();

  async start(): Promise<void> {
    // No daemon to bring up — sanity-check that `claude` is on PATH so we
    // fail loud at boot rather than on the first inbound message.
    await new Promise<void>((resolve, reject) => {
      const c = spawn('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      c.stdout.on('data', d => { out += String(d); });
      c.on('error', reject);
      c.on('exit', code => {
        if (code === 0) {
          log.info({ version: out.trim() }, 'claude agent: ready');
          resolve();
        } else reject(new Error(`claude --version exited with ${code}`));
      });
    });
  }

  async stop(): Promise<void> {
    for (const c of this.children) {
      try { c.kill('SIGTERM'); } catch { /* ignore */ }
    }
    this.children.clear();
  }

  async createThread(): Promise<string> {
    // Pre-allocate a uuid so the Discord thread can be named with it before
    // the first turn runs. Claude Code accepts any valid uuid via
    // `--session-id` and persists the session under that id.
    const id = randomUUID();
    log.info({ thread: id }, 'claude agent: thread allocated');
    return id;
  }

  async sendTurn(threadId: string, text: string, callbacks: AgentTurnCallbacks): Promise<void> {
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
    ];
    if (this.started.has(threadId)) args.push('--resume', threadId);
    else args.push('--session-id', threadId);
    args.push(text);

    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.children.add(child);
    log.debug({ thread: threadId, args: args.slice(0, -1) }, 'claude agent: turn started');

    const session = new TurnSession(callbacks);
    let buffer = '';
    child.stdout?.on('data', d => {
      buffer += String(d);
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          session.handle(JSON.parse(line));
        } catch (err) {
          log.warn({ err: errMsg(err) }, 'claude agent: malformed event');
        }
      }
    });
    child.stderr?.on('data', d => log.trace({ src: 'claude-stderr' }, String(d).trim()));
    child.on('exit', code => {
      this.children.delete(child);
      this.started.add(threadId);
      // If the subprocess exits without a `result` event (crash, OOM, kill),
      // surface that as an error so the orchestrator unsticks the thread.
      if (!session.done) {
        if (code === 0) session.fireComplete();
        else session.fireError(new Error(`claude exited with code ${code}`));
      }
    });
    child.on('error', err => {
      this.children.delete(child);
      if (!session.done) session.fireError(err);
    });
  }
}

// Owns the once-only firing of onComplete/onError and the per-index tool
// tracking so block_stop events can fire onToolEnd correctly.
class TurnSession {
  done = false;
  // Track which content-block indexes belong to tool_use vs text so
  // block_stop fires onToolEnd only for tool blocks.
  private tools = new Map<number, string>();

  constructor(private cb: AgentTurnCallbacks) {}

  fireComplete(): void {
    if (this.done) return;
    this.done = true;
    this.cb.onComplete();
  }

  fireError(err: Error): void {
    if (this.done) return;
    this.done = true;
    this.cb.onError(err);
  }

  handle(ev: ClaudeEvent): void {
    if (ev.type === 'result') {
      if (ev.is_error) this.fireError(new Error(typeof ev.result === 'string' ? ev.result : 'claude error'));
      else this.fireComplete();
      return;
    }
    if (ev.type !== 'stream_event' || !ev.event) return;
    const e = ev.event;
    if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
      this.tools.set(e.index ?? -1, e.content_block.name ?? 'tool');
      this.cb.onToolStart(
        e.content_block.name ?? 'tool',
        summarizeTool(e.content_block.name, e.content_block.input),
      );
    } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
      this.cb.onDelta(e.delta.text ?? '');
    } else if (e.type === 'content_block_stop') {
      const kind = this.tools.get(e.index ?? -1);
      if (kind !== undefined) {
        this.tools.delete(e.index ?? -1);
        this.cb.onToolEnd(kind);
      }
    }
  }
}

type ClaudeEvent = {
  type: string;
  is_error?: boolean;
  result?: unknown;
  event?: {
    type: string;
    index?: number;
    content_block?: { type: string; name?: string; input?: Record<string, unknown> };
    delta?: { type: string; text?: string };
  };
};

function summarizeTool(name: string | undefined, input: Record<string, unknown> | undefined): string {
  const n = (name ?? 'Tool')[0].toUpperCase() + (name ?? 'Tool').slice(1);
  if (!input) return n;
  const path = (input.file_path ?? input.path) as string | undefined;
  const cmd = input.command as string | undefined;
  const pattern = input.pattern as string | undefined;
  const url = input.url as string | undefined;
  switch (name) {
    case 'Bash': return cmd ? `Running: ${truncate(cmd, 60)}` : n;
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return path ? `Editing ${path}` : n;
    case 'Read': return path ? `Reading ${path}` : n;
    case 'Grep':
    case 'Glob':
      return pattern ? `Searching: ${truncate(pattern, 60)}` : n;
    case 'WebFetch': return url ? `Fetching ${url}` : n;
    case 'WebSearch': return 'Searching the web';
    case 'Task': return 'Spawning subagent';
    default: return n;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
