import { createA2uiClient, type A2uiClient, type SurfaceNav, type TransportMetadata } from '@stage-labs/kit/a2ui/client';
import { A2UI_VERSION, ERROR_CODES, isJsonObject, type RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { snapshotOfClient } from '@stage-labs/kit/a2ui/snapshot';
import { frameContentSchema, isSurfaceMessage, type FrameContent, type FrameMessage } from '@stage-labs/client/xmtp/frame.schema';

export interface FrameSessionHost {
  send: (message: RendererMessage, client: A2uiClient, metadata?: TransportMetadata) => void;
  navigate: (nav: SurfaceNav) => void;
  openUrl: (url: string) => void;
}

export type FrameApplied = { kind: 'frame'; frame: FrameContent } | { kind: 'unchanged' } | { kind: 'invalid' };

interface QueuedMessage { message: RendererMessage; metadata?: TransportMetadata }

interface FrameSession {
  frame: FrameContent | null;
  json: string;
  client: A2uiClient;
  host: FrameSessionHost | null;
  queued: QueuedMessage[];
  loading: { client: A2uiClient; token: number } | null;
  loadedBy: number | null;
}

const MAX_QUEUED = 50;
const MAX_SESSIONS = 100;
const sessions = new Map<string, FrameSession>();
let loads = 0;

export const RENDERER_CAPABILITIES: Record<string, unknown> = { ...createA2uiClient().capabilities() };

function deliver(session: FrameSession | undefined, client: A2uiClient, queued: QueuedMessage): void {
  if (session === undefined) return;
  if (session.host !== null) {
    session.host.send(queued.message, client, queued.metadata);
    return;
  }
  if (session.queued.length < MAX_QUEUED) session.queued.push(queued);
}

function buildClient(sessionOf: () => FrameSession | undefined): A2uiClient {
  const client: A2uiClient = createA2uiClient({
    send: (message, metadata) => { deliver(sessionOf(), client, metadata === undefined ? { message } : { message, metadata }); },
    navigate: (nav) => { sessionOf()?.host?.navigate(nav); },
    openUrl: (url) => { sessionOf()?.host?.openUrl(url); },
  });
  return client;
}

function remember(key: string, session: FrameSession): void {
  sessions.delete(key);
  sessions.set(key, session);
  for (const oldest of sessions.keys()) {
    if (sessions.size <= MAX_SESSIONS) break;
    sessions.delete(oldest);
  }
}

function receiveAll(client: A2uiClient, messages: readonly unknown[]): void {
  for (const message of messages) if (isJsonObject(message)) client.receive(message);
}

function createSession(key: string, frame: FrameContent | null, host: FrameSessionHost | null): FrameSession {
  const sessionOf = (): FrameSession | undefined => sessions.get(key);
  const json = frame === null ? '' : JSON.stringify(frame);
  const session: FrameSession = { frame, json, client: buildClient(sessionOf), host, queued: [], loading: null, loadedBy: null };
  remember(key, session);
  if (frame !== null) receiveAll(session.client, frame.messages);
  return session;
}

export function frameSession(key: string, frame: FrameContent): A2uiClient {
  const known = sessions.get(key);
  if (known !== undefined && (known.frame === frame || known.json === JSON.stringify(frame))) {
    known.frame = frame;
    return known.client;
  }
  return createSession(key, frame, known?.host ?? null).client;
}

export function setFrameSessionHost(key: string, host: FrameSessionHost): () => void {
  const session = sessions.get(key);
  if (session === undefined) return () => undefined;
  session.host = host;
  const queued = session.queued.splice(0);
  for (const item of queued) host.send(item.message, session.client, item.metadata);
  return () => { if (session.host === host) session.host = null; };
}

function snapshotFrame(client: A2uiClient, base: FrameContent | null): FrameContent | null {
  const messages = snapshotOfClient(client);
  if (messages.length === 0) return null;
  const ids = messages.map((m) => ('createSurface' in m ? m.createSurface.surfaceId : ''));
  const kept = base === null ? {} : {
    ...(base.title === undefined ? {} : { title: base.title }),
    ...(base.description === undefined ? {} : { description: base.description }),
    ...(base.source === undefined ? {} : { source: base.source }),
    ...(base.start !== undefined && ids.includes(base.start) ? { start: base.start } : {}),
  };
  const parsed = frameContentSchema.safeParse({ ...kept, messages });
  return parsed.success ? parsed.data : null;
}

export function startFrameLoad(key: string): number {
  const session = sessions.get(key) ?? createSession(key, null, null);
  loads += 1;
  session.loading = { client: buildClient(() => sessions.get(key)), token: loads };
  return loads;
}

export function endFrameLoad(key: string, token: number): void {
  const session = sessions.get(key);
  if (session?.loading?.token === token) session.loading = null;
}

function targetOf(session: FrameSession, token: number | undefined): A2uiClient | null {
  if (token === undefined || session.loadedBy === token) return session.client;
  return session.loading?.token === token ? session.loading.client : null;
}

export function applyToFrameSession(key: string, messages: readonly Record<string, unknown>[], token?: number): FrameApplied {
  const session = sessions.get(key);
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

export interface FrameSink {
  onMessage: (message: FrameMessage) => void;
  applied: () => FrameApplied;
}

export function frameSink(key: string, onFrame: (frame: FrameContent) => void, token?: number): FrameSink {
  let applied: FrameApplied = { kind: 'unchanged' };
  return {
    onMessage: (message) => {
      const result = applyToFrameSession(key, [message], token);
      if (result.kind === 'unchanged') return;
      applied = result;
      if (result.kind === 'frame') onFrame(result.frame);
    },
    applied: () => applied,
  };
}

export function rejectAgentCall(key: string, functionCallId: string): void {
  const error = { code: ERROR_CODES.unknownFunction, message: 'No agent answers functions here.' };
  sessions.get(key)?.client.receive({ version: A2UI_VERSION, agentFunctionResponse: { functionCallId, error } });
}

export function clearFrameSessions(): void {
  sessions.clear();
}
