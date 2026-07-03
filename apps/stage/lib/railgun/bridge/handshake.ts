
import type { NodejsChannel } from './nodejsMobile';
import { fmtPayload, status } from './diagnostics';

interface RequestEnvelope { id: number; call: string; params: unknown }

export interface HandshakeDeps {
  channel: NodejsChannel;
  requestEvent: string;
  nextId: () => number;
  onReply: (id: number, resolve: () => void) => void;
  offReply: (id: number) => void;
}

type HandshakeState = 'idle' | 'starting' | 'ready' | 'failed';

const READY_TIMEOUT_MS = 12_000;

export interface Handshake {
  promise: Promise<void>;
  state: () => HandshakeState;
  markReady: () => void;
}

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

  const clearHello = (): void => {
    if (helloId != null) offReply(helloId);
    helloId = null;
  };

  const succeed = (reason: string): void => {
    if (state === 'ready' || state === 'failed') return;
    state = 'ready';
    if (timer) clearTimeout(timer);
    timer = null;
    clearHello();
    status(`bridge ready ✓ (${reason})`);
    resolveReady();
  };

  const fail = (): void => {
    if (state === 'ready' || state === 'failed') return;
    state = 'failed';
    if (timer) clearTimeout(timer);
    timer = null;
    clearHello();
    status('node host did not start within deadline ✗');
    rejectReady(new Error('Railgun bridge: node host did not start'));
  };

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

  const markReady = (): void => { succeed('boot event'); };

  state = 'starting';
  timer = setTimeout(fail, READY_TIMEOUT_MS);
  setTimeout(sendHello, 0);

  return { promise, state: () => state, markReady };
}
