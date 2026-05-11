/** Run a turn; stream response via adapter. In-flight follow-ups queue and drain as one combined turn. */

import { randomUUID } from 'node:crypto';
import type { AgentStation, Attachment } from '../stations/types.js';
import { errMsg, log } from '../log.js';
import { StreamingMessage, type StreamAdapter, type StreamScheduler } from './streaming.js';

const inFlight = new Set<string>();
type Queued = { texts: string[]; dispatch: (text: string) => Promise<void> };
const queued = new Map<string, Queued>();

/** stopId → AbortController. Populated at turn start; fired by `triggerStop` on platform button clicks. */
const stoppers = new Map<string, AbortController>();

/** Invoked by chat stations when a stop button is pressed. Returns true if a turn was actually cancelled. */
export async function triggerStop(stopId: string): Promise<boolean> {
  const ctrl = stoppers.get(stopId);
  if (!ctrl) return false;
  stoppers.delete(stopId); ctrl.abort();
  return true;
}

export async function runTurn(
  agent: AgentStation,
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
    if (q) q.texts.push(text); else queued.set(threadId, { texts: [text], dispatch });
    return;
  }
  inFlight.add(threadId);

  const stream = new StreamingMessage(adapter, scheduler);
  const stopId = `stop-${randomUUID()}`;
  const controller = new AbortController();
  stoppers.set(stopId, controller);
  stream.setStopId(stopId);

  try {
    for await (const ev of agent.sendTurn({ threadId, text, attachments, signal: controller.signal })) {
      if (ev.type === 'delta') stream.appendDelta(ev.text);
      else if (ev.type === 'tool-start') { if (ev.activity.transient) stream.setStatus(ev.activity.name); else stream.appendToolCall(ev.activity.id, ev.activity.name, ev.activity.detail); }
      else if (ev.type === 'tool-end') { if (ev.result) stream.appendToolResult(ev.id, ev.result); stream.setStatus(null); }
    }
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'agent turn failed');
    stream.appendError(errMsg(err) || 'agent turn failed');
  } finally {
    stoppers.delete(stopId);
    stream.setStopId(null);
    await stream.finalize();
    inFlight.delete(threadId);
    const q = queued.get(threadId);
    if (q?.texts.length) {
      queued.delete(threadId);
      await q.dispatch(q.texts.join('\n\n')).catch(err => log.warn({ err: errMsg(err) }, 'queued turn failed'));
    }
  }
}
