/** Run a turn; stream response via adapter. In-flight follow-ups queue and drain as one combined turn. */

import type { Agent, AgentTurnCallbacks } from '../agents/types.js';
import { errMsg, log } from '../log.js';
import { StreamingMessage, type StreamAdapter, type StreamScheduler } from './streaming.js';

const inFlight = new Set<string>();
type Queued = { texts: string[]; dispatch: (text: string) => Promise<void> };
const queued = new Map<string, Queued>();

export async function runTurn(
  agent: Agent,
  threadId: string,
  text: string,
  adapter: StreamAdapter,
  scheduler: StreamScheduler,
): Promise<void> {
  const dispatch = (t: string): Promise<void> => runTurn(agent, threadId, t, adapter, scheduler);

  if (inFlight.has(threadId)) {
    const q = queued.get(threadId);
    if (q) q.texts.push(text);
    else queued.set(threadId, { texts: [text], dispatch });
    return;
  }
  inFlight.add(threadId);

  const stream = new StreamingMessage(adapter, scheduler);

  const finishAndDrain = async (): Promise<void> => {
    await stream.finalize();
    inFlight.delete(threadId);
    const q = queued.get(threadId);
    if (!q?.texts.length) return;
    queued.delete(threadId);
    await q.dispatch(q.texts.join('\n\n')).catch(err => log.warn({ err: errMsg(err) }, 'queued turn failed'));
  };

  const callbacks: AgentTurnCallbacks = {
    onDelta: d => stream.appendDelta(d),
    onToolStart: a => a.transient ? stream.setStatus(a.name) : stream.appendToolCall(a.id, a.name, a.detail),
    onToolEnd: (id, result) => { if (result) stream.appendToolResult(id, result); stream.setStatus(null); },
    onComplete: () => { void finishAndDrain(); },
    onError: err => {
      log.warn({ err: errMsg(err) }, 'agent turn failed');
      stream.appendError(errMsg(err) || 'agent turn failed');
      void finishAndDrain();
    },
  };

  await agent.sendTurn(threadId, text, callbacks);
}
