import { createA2uiClient, type A2uiClient, type SurfaceNav, type TransportMetadata } from '@stage-labs/kit/a2ui/client';
import { A2UI_VERSION, ERROR_CODES, isJsonObject, type RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { snapshotOfClient } from '@stage-labs/kit/a2ui/snapshot';
import type { NodeResult } from '@stage-labs/client/nodes/protocol';
import { frameContentSchema, isSurfaceMessage, type FrameContent, type FrameMessage } from '@stage-labs/client/xmtp/frame.schema';

export interface FrameSessionHost {
  accepts: (message: RendererMessage, engaged: boolean) => boolean;
  send: (message: RendererMessage, client: A2uiClient, metadata?: TransportMetadata) => void;
  navigate: (nav: SurfaceNav) => void;
  openUrl: (url: string) => void;
}

export type FrameApplied = { kind: 'frame'; frame: FrameContent } | { kind: 'unchanged' } | { kind: 'invalid' };

export type FrameRun = (onMessage: (message: FrameMessage) => void) => Promise<NodeResult>;

export interface FrameSessions {
  clientFor: (key: string, frame: FrameContent) => A2uiClient;
  setHost: (key: string, host: FrameSessionHost) => () => void;
  activateHost: (key: string, host: FrameSessionHost) => void;
  release: (key: string) => void;
  engage: (key: string) => void;
  apply: (key: string, messages: readonly Record<string, unknown>[], token?: number) => FrameApplied;
  streamInto: (
    key: string,
    load: boolean,
    onFrame: (frame: FrameContent) => void,
    run: FrameRun,
  ) => Promise<{ result: NodeResult; applied: FrameApplied }>;
  rejectAgentCall: (key: string, functionCallId: string) => void;
  clear: () => void;
}

interface QueuedMessage {
  message: RendererMessage;
  client: A2uiClient;
  metadata?: TransportMetadata;
}

interface FrameSession {
  frame: FrameContent | null;
  json: string;
  client: A2uiClient;
  queued: QueuedMessage[];
  loading: { client: A2uiClient; token: number } | null;
  loadedBy: number | null;
}

interface SessionStore {
  sessions: Map<string, FrameSession>;
  hostsByKey: Map<string, FrameSessionHost[]>;
  engagedKeys: Set<string>;
  loads: number;
}

const MAX_QUEUED = 50;
const MAX_SESSIONS = 100;

function hostOf(store: SessionStore, key: string): FrameSessionHost | undefined {
  return store.hostsByKey.get(key)?.at(-1);
}

function deliver(store: SessionStore, key: string, item: QueuedMessage): void {
  const host = hostOf(store, key);
  if (host !== undefined && host.accepts(item.message, store.engagedKeys.has(key))) {
    host.send(item.message, item.client, item.metadata);
    return;
  }
  const session = store.sessions.get(key);
  if (session !== undefined && session.queued.length < MAX_QUEUED) session.queued.push(item);
}

function release(store: SessionStore, key: string): void {
  for (const item of store.sessions.get(key)?.queued.splice(0) ?? []) deliver(store, key, item);
}

function buildClient(store: SessionStore, key: string): A2uiClient {
  const client: A2uiClient = createA2uiClient({
    send: (message, metadata) => {
      deliver(store, key, { message, client, metadata });
    },
    navigate: (nav) => {
      hostOf(store, key)?.navigate(nav);
    },
    openUrl: (url) => {
      hostOf(store, key)?.openUrl(url);
    },
  });
  return client;
}

function remember(store: SessionStore, key: string, session: FrameSession): void {
  store.sessions.delete(key);
  store.sessions.set(key, session);
  for (const oldest of store.sessions.keys()) {
    if (store.sessions.size <= MAX_SESSIONS) break;
    store.sessions.delete(oldest);
  }
}

function receiveAll(client: A2uiClient, messages: readonly unknown[]): void {
  for (const message of messages) if (isJsonObject(message)) client.receive(message);
}

function createSession(store: SessionStore, key: string, frame: FrameContent | null): FrameSession {
  const json = frame === null ? '' : JSON.stringify(frame);
  const session: FrameSession = { frame, json, client: buildClient(store, key), queued: [], loading: null, loadedBy: null };
  remember(store, key, session);
  if (frame !== null) receiveAll(session.client, frame.messages);
  return session;
}

function clientFor(store: SessionStore, key: string, frame: FrameContent): A2uiClient {
  const known = store.sessions.get(key);
  if (known !== undefined && (known.frame === frame || known.json === JSON.stringify(frame))) {
    known.frame = frame;
    remember(store, key, known);
    return known.client;
  }
  return createSession(store, key, frame).client;
}

function withoutHost(store: SessionStore, key: string, host: FrameSessionHost): FrameSessionHost[] {
  const hosts = (store.hostsByKey.get(key) ?? []).filter((known) => known !== host);
  if (hosts.length === 0) store.hostsByKey.delete(key);
  else store.hostsByKey.set(key, hosts);
  return hosts;
}

function setHost(store: SessionStore, key: string, host: FrameSessionHost): () => void {
  store.hostsByKey.set(key, [...withoutHost(store, key, host), host]);
  release(store, key);
  return () => {
    withoutHost(store, key, host);
  };
}

function activateHost(store: SessionStore, key: string, host: FrameSessionHost): void {
  if (hostOf(store, key) !== host && store.hostsByKey.get(key)?.includes(host) === true) {
    store.hostsByKey.set(key, [...withoutHost(store, key, host), host]);
  }
}

function engage(store: SessionStore, key: string): void {
  if (store.engagedKeys.has(key)) return;
  store.engagedKeys.add(key);
  release(store, key);
}

function snapshotFrame(client: A2uiClient, base: FrameContent | null): FrameContent | null {
  const messages = snapshotOfClient(client);
  const kept = messages.some((m) => 'createSurface' in m && m.createSurface.surfaceId === base?.start);
  const parsed = frameContentSchema.safeParse({ ...base, messages, start: kept ? base?.start : undefined });
  return parsed.success ? parsed.data : null;
}

function startLoad(store: SessionStore, key: string): number {
  const session = store.sessions.get(key) ?? createSession(store, key, null);
  store.loads += 1;
  session.loading = { client: buildClient(store, key), token: store.loads };
  return store.loads;
}

function targetOf(session: FrameSession, token: number | undefined): A2uiClient | null {
  if (token === undefined || session.loadedBy === token) return session.client;
  return session.loading?.token === token ? session.loading.client : null;
}

function apply(store: SessionStore, key: string, messages: readonly Record<string, unknown>[], token?: number): FrameApplied {
  const session = store.sessions.get(key);
  if (session === undefined) return { kind: 'invalid' };
  const target = targetOf(session, token);
  if (target === null) return { kind: 'unchanged' };
  receiveAll(target, messages);
  if (!messages.some(isSurfaceMessage)) return { kind: 'unchanged' };
  const loading = target !== session.client;
  const frame = snapshotFrame(target, loading ? null : session.frame);
  if (frame === null) return loading ? { kind: 'unchanged' } : { kind: 'invalid' };
  if (loading) {
    session.client = target;
    session.loading = null;
    session.loadedBy = token ?? null;
  }
  session.frame = frame;
  session.json = JSON.stringify(frame);
  return { kind: 'frame', frame };
}

async function streamInto(
  store: SessionStore,
  key: string,
  load: boolean,
  onFrame: (frame: FrameContent) => void,
  run: FrameRun,
): Promise<{ result: NodeResult; applied: FrameApplied }> {
  const token = load ? startLoad(store, key) : undefined;
  let applied: FrameApplied = { kind: 'unchanged' };
  try {
    const result = await run((message) => {
      const step = apply(store, key, [message], token);
      if (step.kind === 'unchanged') return;
      applied = step;
      if (step.kind === 'frame') onFrame(step.frame);
    });
    return { result, applied };
  } finally {
    const session = store.sessions.get(key);
    if (token !== undefined && session?.loading?.token === token) session.loading = null;
  }
}

function rejectAgentCall(store: SessionStore, key: string, functionCallId: string): void {
  const error = { code: ERROR_CODES.unknownFunction, message: 'No agent answers functions here.' };
  store.sessions.get(key)?.client.receive({ version: A2UI_VERSION, agentFunctionResponse: { functionCallId, error } });
}

export function makeFrameSessions(): FrameSessions {
  const store: SessionStore = { sessions: new Map(), hostsByKey: new Map(), engagedKeys: new Set(), loads: 0 };
  return {
    clientFor: (key, frame) => clientFor(store, key, frame),
    setHost: (key, host) => setHost(store, key, host),
    activateHost: (key, host) => {
      activateHost(store, key, host);
    },
    release: (key) => {
      release(store, key);
    },
    engage: (key) => {
      engage(store, key);
    },
    apply: (key, messages, token) => apply(store, key, messages, token),
    streamInto: (key, load, onFrame, run) => streamInto(store, key, load, onFrame, run),
    rejectAgentCall: (key, functionCallId) => {
      rejectAgentCall(store, key, functionCallId);
    },
    clear: () => {
      store.sessions.clear();
      store.engagedKeys.clear();
    },
  };
}
