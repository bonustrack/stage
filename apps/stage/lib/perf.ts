import { errorMessage } from '@stage-labs/client/errors';
import { recover } from './errorPolicy';

const TRACE_FLAG = 'stage.perf';
const SLOW_CALL_MS = 20;

function traceFlagSet(): boolean {
  const read = (): boolean => typeof localStorage !== 'undefined' && localStorage.getItem(TRACE_FLAG) === '1';
  try { return read(); } catch (e) { return recover('perf.flag', false)(e); }
}

const flagged = traceFlagSet();
const tracing = __DEV__ || flagged;

export function perfLog(label: string, extra?: Record<string, unknown>): void {
  if (!tracing) return;
  console.log(`[perf +${Math.round(performance.now())}ms] ${label}`, extra ?? '');
}

export async function perfTime<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let outcome = 'ok';
  try {
    return await fn();
  } catch (e) {
    outcome = `threw: ${errorMessage(e)}`;
    throw e;
  } finally {
    perfLog(label, { ms: Math.round(performance.now() - started), outcome });
  }
}

interface WorkerCall { id: string; action: string }

function workerCallOf(message: unknown): WorkerCall | null {
  if (typeof message !== 'object' || message === null) return null;
  const { id, action } = message as { id?: unknown; action?: unknown };
  return typeof id === 'string' && typeof action === 'string' ? { id, action } : null;
}

function traceWorkerCalls(): void {
  if (typeof Worker === 'undefined') return;
  const started = new Map<string, { action: string; at: number }>();
  const onReply = (event: MessageEvent<unknown>): void => {
    const reply = event.data as { id?: unknown };
    const call = typeof reply?.id === 'string' ? started.get(reply.id) : undefined;
    if (!call || typeof reply.id !== 'string') return;
    started.delete(reply.id);
    const ms = Math.round(performance.now() - call.at);
    if (ms >= SLOW_CALL_MS) perfLog(`xmtp ${call.action}`, { startedAt: Math.round(call.at), ms });
  };
  globalThis.Worker = class TracedWorker extends Worker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      this.addEventListener('message', onReply);
    }

    override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]): void {
      const call = workerCallOf(message);
      if (call) started.set(call.id, { action: call.action, at: performance.now() });
      if (Array.isArray(options)) super.postMessage(message, options);
      else super.postMessage(message, options);
    }
  };
}

if (flagged) traceWorkerCalls();
