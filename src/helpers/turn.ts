/** Run a turn; stream response via adapter. In-flight follow-ups queue and drain as one combined turn. */

import { randomUUID } from 'node:crypto';
import type { Agent, AgentTurnCallbacks, Attachment } from '../agents/types.js';
import { errMsg, log } from '../log.js';
import { StreamingMessage, type StreamAdapter, type StreamScheduler } from './streaming.js';

const inFlight = new Set<string>();
type Queued = { texts: string[]; dispatch: (text: string) => Promise<void> };
const queued = new Map<string, Queued>();

/** stopId → cancel function. Populated at turn start; fired by `triggerStop` on platform button clicks. */
const stoppers = new Map<string, () => Promise<void>>();

/** Invoked by channel adapters when a stop button is pressed. Returns true if a turn was actually cancelled. */
export async function triggerStop(stopId: string): Promise<boolean> {
  const fn = stoppers.get(stopId);
  if (!fn) return false;
  stoppers.delete(stopId);
  await fn().catch(err => log.warn({ err: errMsg(err), stopId }, 'stop trigger failed'));
  return true;
}

export async function runTurn(
  agent: Agent,
  threadId: string,
  text: string,
  attachments: Attachment[],
  adapter: StreamAdapter,
  scheduler: StreamScheduler,
): Promise<void> {
  /** Queued follow-ups carry only text (next turn re-fetches its own attachments). */
  const dispatch = (t: string): Promise<void> => runTurn(agent, threadId, t, [], adapter, scheduler);

  if (inFlight.has(threadId)) {
    const q = queued.get(threadId);
    if (q) q.texts.push(text);
    else queued.set(threadId, { texts: [text], dispatch });
    return;
  }
  inFlight.add(threadId);

  const stream = new StreamingMessage(adapter, scheduler);
  const stopId = `stop-${randomUUID()}`;
  stoppers.set(stopId, () => agent.cancelTurn(threadId));
  stream.setStopId(stopId);

  const finishAndDrain = async (): Promise<void> => {
    stoppers.delete(stopId);
    stream.setStopId(null);
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

  await agent.sendTurn(threadId, text, attachments, callbacks);
}
