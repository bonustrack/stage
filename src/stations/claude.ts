/** Claude Code station: per-turn `claude -p` subprocess; --session-id then --resume (persisted across restarts). */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AsyncQueue } from '../helpers/async-queue.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import type { AgentStation, Capabilities, TurnEvent, TurnRequest } from './types.js';

const STARTED_FILE = join(STATE_DIR, 'claude-sessions.json');

function loadStarted(): Set<string> {
  if (!existsSync(STARTED_FILE)) return new Set();
  try { return new Set(JSON.parse(readFileSync(STARTED_FILE, 'utf8')) as string[]); }
  catch (err) { log.warn({ err: errMsg(err), path: STARTED_FILE }, 'claude: started cache read failed'); return new Set(); }
}

export const CAPABILITIES: Capabilities = {
  in: ['text', 'image'], out: ['text'],
  features: ['stream', 'tools', 'cancel', 'attachments'],
};

export class ClaudeStation implements AgentStation {
  readonly name = 'claude';
  readonly capabilities = CAPABILITIES;

  private started = loadStarted();
  private children = new Set<ChildProcess>();

  private persistStarted(): void {
    try { writeFileSync(STARTED_FILE, JSON.stringify([...this.started])); }
    catch (err) { log.warn({ err: errMsg(err), path: STARTED_FILE }, 'claude: started cache write failed'); }
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const c = spawn('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; c.stdout.on('data', d => { out += String(d); });
      c.on('error', reject);
      c.on('exit', code => code === 0
        ? (log.info({ version: out.trim() }, 'claude station: ready'), resolve())
        : reject(new Error(`claude --version exited with ${code}`)));
    });
  }

  async stop(): Promise<void> {
    for (const c of this.children) { try { c.kill('SIGTERM'); } catch { /* ignore */ } }
    this.children.clear();
  }

  async createThread(): Promise<string> {
    const id = randomUUID();
    log.info({ thread: id }, 'claude station: thread allocated');
    return id;
  }

  sendTurn(req: TurnRequest): AsyncIterable<TurnEvent> {
    const queue = new AsyncQueue<TurnEvent>();
    void this.runTurn(req, queue);
    return queue;
  }

  private async runTurn(req: TurnRequest, queue: AsyncQueue<TurnEvent>): Promise<void> {
    const { threadId, text, attachments, signal } = req;
    const args = ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--include-partial-messages', '--verbose'];
    args.push(this.started.has(threadId) ? '--resume' : '--session-id', threadId);

    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.children.add(child);
    log.debug({ thread: threadId, attachments: attachments.length }, 'claude station: turn started');
    const onAbort = (): void => { try { child.kill('SIGTERM'); } catch { /* already exited */ } };
    signal?.addEventListener('abort', onAbort, { once: true });

    const content: unknown[] = [];
    if (text) content.push({ type: 'text', text });
    for (const a of attachments) content.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data.toString('base64') } });
    if (!content.length) content.push({ type: 'text', text: '' });
    child.stdin?.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
    child.stdin?.end();

    const session = new TurnSession(queue);
    let buffer = '';
    child.stdout?.on('data', d => {
      buffer += String(d); let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
        if (line) try { session.handle(JSON.parse(line)); } catch (err) { log.warn({ err: errMsg(err) }, 'claude station: malformed event'); }
      }
    });
    child.stderr?.on('data', d => log.trace({ src: 'claude-stderr' }, String(d).trim()));
    child.on('exit', code => {
      this.children.delete(child); signal?.removeEventListener('abort', onAbort);
      if (!this.started.has(threadId)) { this.started.add(threadId); this.persistStarted(); }
      /** 143 = 128 + SIGTERM(15); only sent via abort. */
      if (code === 0) session.complete();
      else session.fail(new Error(code === 143 ? 'Interrupted' : `claude exited with code ${code}`));
    });
    child.on('error', err => { this.children.delete(child); session.fail(err); });
  }
}

class TurnSession {
  private thinking = true;
  /** tool_use_id → kind; survives until the matching tool_result lands. */
  private byUseId = new Map<string, string>();
  /** Pending tool_use blocks: input JSON streams in over multiple `input_json_delta` events before the input is complete. */
  private pendingTools = new Map<number, { id: string; kind: string; toolName: string | undefined; inputJson: string }>();

  constructor(private queue: AsyncQueue<TurnEvent>) {
    queue.push({ type: 'tool-start', activity: { id: 'thinking', kind: 'thinking', name: 'Thinking…', transient: true } });
  }

  complete(): void { this.clearThinking(); this.queue.finish(); }
  fail(err: Error): void { this.clearThinking(); this.queue.fail(err); }
  private clearThinking(): void {
    if (!this.thinking) return;
    this.thinking = false; this.queue.push({ type: 'tool-end', id: 'thinking' });
  }

  handle(ev: ClaudeEvent): void {
    if (ev.type === 'result') {
      if (ev.is_error) this.fail(new Error(typeof ev.result === 'string' ? ev.result : 'claude error'));
      else this.complete();
      return;
    }
    if (ev.type === 'user') { this.handleToolResults(ev); return; }
    if (ev.type !== 'stream_event' || !ev.event) return;
    const e = ev.event;
    if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
      this.clearThinking();
      const idx = e.index ?? -1, kind = e.content_block.name ?? 'tool';
      const id = e.content_block.id ?? `${kind}:${idx}`;
      this.byUseId.set(id, kind);
      this.pendingTools.set(idx, { id, kind, toolName: e.content_block.name, inputJson: '' });
    } else if (e.type === 'content_block_delta' && e.delta?.type === 'input_json_delta') {
      const tool = this.pendingTools.get(e.index ?? -1);
      if (tool) tool.inputJson += e.delta.partial_json ?? '';
    } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
      this.clearThinking();
      this.queue.push({ type: 'delta', text: e.delta.text ?? '' });
    } else if (e.type === 'content_block_stop') {
      const tool = this.pendingTools.get(e.index ?? -1);
      if (!tool) return;
      this.pendingTools.delete(e.index ?? -1);
      let input: Record<string, unknown> | undefined;
      try { input = tool.inputJson ? JSON.parse(tool.inputJson) as Record<string, unknown> : undefined; }
      catch { /* malformed mid-stream — show name only */ }
      const { name, detail } = summarizeTool(tool.toolName, input);
      this.queue.push({ type: 'tool-start', activity: { id: tool.id, kind: tool.kind, name, detail } });
    }
  }

  /** Claude emits `tool_result` blocks inside a follow-up `user` message after the tool runs. */
  private handleToolResults(ev: ClaudeEvent): void {
    for (const block of ev.message?.content ?? []) {
      if (block.type !== 'tool_result' || !block.tool_use_id || !this.byUseId.has(block.tool_use_id)) continue;
      this.byUseId.delete(block.tool_use_id);
      this.queue.push({ type: 'tool-end', id: block.tool_use_id, result: extractResultText(block.content) });
    }
  }
}

type ResultBlock = { type: string; text?: string };
type ClaudeEvent = {
  type: string; is_error?: boolean; result?: unknown;
  message?: { content?: Array<{ type: string; tool_use_id?: string; content?: unknown }> };
  event?: { type: string; index?: number;
    content_block?: { type: string; name?: string; id?: string; input?: Record<string, unknown> };
    delta?: { type: string; text?: string; partial_json?: string } };
};

function extractResultText(content: unknown): string | undefined {
  if (typeof content === 'string') return content.trim() || undefined;
  if (!Array.isArray(content)) return undefined;
  const text = (content as ResultBlock[]).filter(b => b?.type === 'text').map(b => b.text ?? '').join('\n').trim();
  return text || undefined;
}

function summarizeTool(name: string | undefined, input: Record<string, unknown> | undefined): { name: string; detail?: string } {
  const display = (name ?? 'Tool')[0].toUpperCase() + (name ?? 'Tool').slice(1);
  if (!input) return { name: display };
  const path = (input.file_path ?? input.path) as string | undefined;
  const cmd = input.command as string | undefined, pattern = input.pattern as string | undefined;
  switch (name) {
    case 'Bash': return { name: 'Bash', detail: cmd };
    case 'Edit': case 'Write': case 'NotebookEdit': return { name: display, detail: path };
    case 'Read': return { name: 'Read', detail: path };
    case 'Grep': case 'Glob': return { name: display, detail: pattern };
    case 'WebFetch': return { name: 'WebFetch', detail: input.url as string | undefined };
    case 'WebSearch': return { name: 'WebSearch', detail: input.query as string | undefined };
    case 'Task': return { name: 'Task', detail: (input.description ?? input.subagent_type) as string | undefined };
    default: return { name: display };
  }
}
