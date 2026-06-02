/** Robust readiness handshake for the nodejs-mobile bridge.
 *
 *  The channel does NOT buffer: a request posted before main.js registers its
 *  'rg:request' listener is silently dropped and the call hangs to timeout. The
 *  host emits a one-shot boot event (READY_EVENT) right after registering, but
 *  if the RN listener attaches a hair too late we miss that single emit and the
 *  ready gate deadlocks forever.
 *
 *  Fix: resolve readiness on EITHER (a) the boot event, OR (b) a retrying ping
 *  whose first reply proves the host channel + 'rg:request' listener are live.
 *  The pings write DIRECTLY to the channel (they must not await the ready gate
 *  they exist to satisfy), correlated by id like normal calls. */
import type { NodejsChannel } from './nodejsMobile';
import { fmtPayload, status } from './diagnostics';

/** Wire envelope shape (mirrors index.ts; kept local to avoid a cycle). */
interface RequestEnvelope { id: number; call: string; params: unknown }

/** Inputs the handshake needs from the bridge module. */
export interface HandshakeDeps {
  channel: NodejsChannel;
  requestEvent: string;
  /** Allocate the next monotonic correlation id (shared nextId counter). */
  nextId: () => number;
  /** Register a one-shot reply resolver keyed by id (the pending map). */
  onReply: (id: number, resolve: () => void) => void;
  /** Drop a previously-registered reply resolver (cleanup on stop). */
  offReply: (id: number) => void;
}

/** ~400-600ms between probe pings; ~20 attempts ≈ 12s before we give up. */
const PING_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 20;

/** Start the retrying-ping + boot-event race. Resolves the returned promise the
 *  instant readiness is proven by either path, rejects after the attempt cap so
 *  the UI shows a real failure instead of a silent 15s-per-call hang. Returns a
 *  stop() to halt the retry loop once another path (boot event) wins. */
export function startReadinessHandshake(deps: HandshakeDeps): {
  promise: Promise<void>;
  /** Resolve readiness now (e.g. the boot event fired) + halt the retry loop. */
  markReady: () => void;
} {
  const { channel, requestEvent, nextId, onReply, offReply } = deps;
  let settled = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const inflight = new Set<number>();

  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  const cleanup = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    for (const id of inflight) offReply(id);
    inflight.clear();
  };

  const succeed = (reason: string): void => {
    if (settled) return;
    settled = true;
    status(`bridge ready ✓ (${reason})`);
    cleanup();
    resolveReady();
  };

  const markReady = (): void => succeed('boot event');

  const sendPing = (): void => {
    if (settled) return;
    attempts += 1;
    if (attempts > MAX_ATTEMPTS) {
      settled = true;
      cleanup();
      status('node host did not start (no handshake reply) ✗');
      rejectReady(new Error('Railgun bridge: node host did not start'));
      return;
    }
    const id = nextId();
    inflight.add(id);
    // First reply for THIS id means the host's channel + rg:request listener
    // are live → the bridge is ready.
    onReply(id, () => {
      inflight.delete(id);
      succeed(`handshake ping id ${id}`);
    });
    const envelope: RequestEnvelope = { id, call: 'ping', params: { handshake: true } };
    status(`handshake ping → (id ${id}, attempt ${attempts}) ${fmtPayload(envelope.params)}`);
    // Direct channel write — bypasses the ready gate this handshake satisfies.
    channel.post(requestEvent, envelope);
    timer = setTimeout(sendPing, PING_INTERVAL_MS);
  };

  // Kick the first ping on the next tick so all listeners are attached first.
  timer = setTimeout(sendPing, 0);

  return { promise, markReady };
}
