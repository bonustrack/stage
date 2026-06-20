/** @file Event-driven readiness gate for the nodejs-mobile bridge that resolves on either the host boot event or a single deterministic 'hello' reply, with one timeout instead of a polling retry loop. */

/** Deterministic, non-polling readiness handshake for the unbuffered nodejs-mobile bridge: listeners attach before mod.start, readiness resolves on whichever lands first (boot event or a single 'hello' reply, which also re-triggers the boot event), and one timeout fails the idle->starting->ready|failed gate loudly. */
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

/** Starts the readiness gate; the caller must have attached boot-event + reply listeners and must call mod.start right after this returns, so the single posted 'hello' lands once the host is live (or is re-sent on the boot event). */
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

  /** Posts a single deterministic 'hello' directly (bypassing the gate it satisfies); its reply proves the host channel + rg:request listener are live, and the host's re-emitted boot event makes this double as request-ready-on-attach. */
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
  /** Post the single hello on the next tick so the caller can finish wiring + call mod.start first; the hello reply or the boot event resolves readiness. */
  setTimeout(sendHello, 0);

  return { promise, state: () => state, markReady };
}
