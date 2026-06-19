/** @file Event-driven readiness gate for the nodejs-mobile bridge that resolves on either the host boot event or a single deterministic 'hello' reply, with one timeout instead of a polling retry loop. */

/*
 * Event-driven readiness handshake for the nodejs-mobile bridge.
 *
 *  THE BOOT RACE: the nodejs-mobile channel does NOT buffer. A request posted
 *  before main.js registers its 'rg:request' listener is silently dropped, and
 *  the host's one-shot boot event (READY_EVENT) is likewise lost if the RN side
 *  attaches its listener a hair AFTER mod.start. Either miss used to deadlock
 *  behind a ~12s ping-retry loop.
 *
 *  THE FIX (deterministic, no polling loop):
 *    1. The RN side attaches ALL listeners (reply + boot event) BEFORE calling
 *       mod.start (enforced by the caller in index.ts - start happens last).
 *    2. Readiness resolves on EITHER signal, whichever lands first:
 *         (a) the host's boot event (markReady), OR
 *         (b) the reply to a single deterministic 'hello' request.
 *       The host answers 'hello' AND re-emits its boot event on receiving it, so
 *       even if (a) was missed, (b) both proves liveness and re-triggers (a).
 *       A 'hello' arriving before the listener is up is a no-op: we resend it
 *       exactly ONCE when the boot event lands (request-ready-on-attach).
 *    3. A SINGLE timeout (not a 20x retry loop) fails the gate loudly so the UI
 *       shows a real error instead of a silent per-call hang.
 *
 *  STATE MACHINE: idle -> starting -> ready | failed. Terminal states are sticky
 *  (settled guard); every transition flows through one place.
 */
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
  /** Register a one-shot reply resolver keyed by id (checked before pending). */
  onReply: (id: number, resolve: () => void) => void;
  /** Drop a previously-registered reply resolver (cleanup on settle). */
  offReply: (id: number) => void;
}

/** Explicit lifecycle of the readiness gate. */
type HandshakeState = 'idle' | 'starting' | 'ready' | 'failed';

/** Single deadline for the whole gate. The host boots + registers its listener in well under this; exceeding it means the native runtime never came up. */
const READY_TIMEOUT_MS = 12_000;

export interface Handshake {
  promise: Promise<void>;
  /** Current lifecycle state (for diagnostics). */
  state: () => HandshakeState;
  /** The boot event fired: resolve readiness (or, if a 'hello' is still in flight, this just wins the race). Idempotent. */
  markReady: () => void;
}

/**
 * Start the event-driven readiness gate. The caller MUST have attached the boot
 *  event + reply listeners already, and MUST call mod.start immediately after
 *  this returns (so the single 'hello' we post lands once the host is live, or
 *  is harmlessly dropped and re-sent on the boot event).
 */
export function startReadinessHandshake(deps: HandshakeDeps): Handshake {
  const { channel, requestEvent, nextId, onReply, offReply } = deps;
  let state: HandshakeState = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let helloId: number | null = null;

  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  /** Clear Hello. */
  const clearHello = (): void => {
    if (helloId != null) offReply(helloId);
    helloId = null;
  };

  /** Succeed helper. */
  const succeed = (reason: string): void => {
    if (state === 'ready' || state === 'failed') return;
    state = 'ready';
    if (timer) clearTimeout(timer);
    timer = null;
    clearHello();
    status(`bridge ready ✓ (${reason})`);
    resolveReady();
  };

  /** Fail helper. */
  const fail = (): void => {
    if (state === 'ready' || state === 'failed') return;
    state = 'failed';
    if (timer) clearTimeout(timer);
    timer = null;
    clearHello();
    status('node host did not start within deadline ✗');
    rejectReady(new Error('Railgun bridge: node host did not start'));
  };

  /**
   * Post a single deterministic 'hello'. Its reply proves the host channel +
   *  rg:request listener are live → readiness. Posted directly so it bypasses
   *  the ready gate it exists to satisfy. The host also re-emits its boot event
   *  on receiving 'hello', so this doubles as request-ready-on-attach: if the
   *  original boot event was missed, the reply (or the re-emit) still resolves.
   */
  const sendHello = (): void => {
    if (state !== 'starting') return;
    const id = nextId();
    helloId = id;
    onReply(id, () => {
      if (helloId === id) helloId = null;
      succeed(`hello reply id ${id}`);
    });
    const envelope: RequestEnvelope = { id, call: 'hello', params: { handshake: true } };
    status(`handshake hello → (id ${id}) ${fmtPayload(envelope.params)}`);
    channel.post(requestEvent, envelope);
  };

  /** Boot event landed (initial emit OR the re-emit our 'hello' triggers). Resolves readiness; first signal wins. Idempotent via succeed's guard. */
  const markReady = (): void => { succeed('boot event'); };

  state = 'starting';
  timer = setTimeout(fail, READY_TIMEOUT_MS);
  // Post the single hello on the next tick so the caller can finish wiring +
  // call mod.start first. The hello reply OR the boot event resolves readiness.
  setTimeout(sendHello, 0);

  return { promise, state: () => state, markReady };
}
