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

const MAX_QUEUED = 50;
const MAX_SESSIONS = 100;
const sessions = new Map<string, FrameSession>();
const hostsByKey = new Map<string, FrameSessionHost[]>();
const engagedKeys = new Set<string>();
let loads = 0;

export const RENDERER_CAPABILITIES: Record<string, unknown> = { ...createA2uiClient().capabilities() };

function hostOf(key: string): FrameSessionHost | undefined {
  return hostsByKey.get(key)?.at(-1);
}

function deliver(key: string, item: QueuedMessage): void {
  const host = hostOf(key);
  if (host !== undefined && host.accepts(item.message, engagedKeys.has(key))) {
    host.send(item.message, item.client, item.metadata);
    return;
  }
  const session = sessions.get(key);
  if (session !== undefined && session.queued.length < MAX_QUEUED) session.queued.push(item);
}

export function releaseFrameSession(key: string): void {
  for (const item of sessions.get(key)?.queued.splice(0) ?? []) deliver(key, item);
}

function buildClient(key: string): A2uiClient {
  const client: A2uiClient = createA2uiClient({
    send: (message, metadata) => {
      deliver(key, { message, client, metadata });
    },
    navigate: (nav) => {
      hostOf(key)?.navigate(nav);
    },
    openUrl: (url) => {
      hostOf(key)?.openUrl(url);
    },
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

function createSession(key: string, frame: FrameContent | null): FrameSession {
  const json = frame === null ? '' : JSON.stringify(frame);
  const session: FrameSession = { frame, json, client: buildClient(key), queued: [], loading: null, loadedBy: null };
  remember(key, session);
  if (frame !== null) receiveAll(session.client, frame.messages);
  return session;
}

export function frameSession(key: string, frame: FrameContent): A2uiClient {
  const known = sessions.get(key);
  if (known !== undefined && (known.frame === frame || known.json === JSON.stringify(frame))) {
    known.frame = frame;
    remember(key, known);
    return known.client;
  }
  return createSession(key, frame).client;
}

function withoutHost(key: string, host: FrameSessionHost): FrameSessionHost[] {
  const hosts = (hostsByKey.get(key) ?? []).filter((known) => known !== host);
  if (hosts.length === 0) hostsByKey.delete(key);
  else hostsByKey.set(key, hosts);
  return hosts;
}

export function setFrameSessionHost(key: string, host: FrameSessionHost): () => void {
  hostsByKey.set(key, [...withoutHost(key, host), host]);
  releaseFrameSession(key);
  return () => {
    withoutHost(key, host);
  };
}

export function activateFrameSessionHost(key: string, host: FrameSessionHost): void {
  if (hostOf(key) !== host && hostsByKey.get(key)?.includes(host) === true) hostsByKey.set(key, [...withoutHost(key, host), host]);
}

export function engageFrameSession(key: string): void {
  if (engagedKeys.has(key)) return;
  engagedKeys.add(key);
  releaseFrameSession(key);
}

function snapshotFrame(client: A2uiClient, base: FrameContent | null): FrameContent | null {
  const messages = snapshotOfClient(client);
  const kept = messages.some((m) => 'createSurface' in m && m.createSurface.surfaceId === base?.start);
  const parsed = frameContentSchema.safeParse({ ...base, messages, start: kept ? base?.start : undefined });
  return parsed.success ? parsed.data : null;
}

function startFrameLoad(key: string): number {
  const session = sessions.get(key) ?? createSession(key, null);
  loads += 1;
  session.loading = { client: buildClient(key), token: loads };
  return loads;
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

export async function streamInto(
  key: string,
  load: boolean,
  onFrame: (frame: FrameContent) => void,
  run: (onMessage: (message: FrameMessage) => void) => Promise<NodeResult>,
): Promise<{ result: NodeResult; applied: FrameApplied }> {
  const token = load ? startFrameLoad(key) : undefined;
  let applied: FrameApplied = { kind: 'unchanged' };
  try {
    const result = await run((message) => {
      const step = applyToFrameSession(key, [message], token);
      if (step.kind === 'unchanged') return;
      applied = step;
      if (step.kind === 'frame') onFrame(step.frame);
    });
    return { result, applied };
  } finally {
    const session = sessions.get(key);
    if (token !== undefined && session?.loading?.token === token) session.loading = null;
  }
}

export function rejectAgentCall(key: string, functionCallId: string): void {
  const error = { code: ERROR_CODES.unknownFunction, message: 'No agent answers functions here.' };
  sessions.get(key)?.client.receive({ version: A2UI_VERSION, agentFunctionResponse: { functionCallId, error } });
}

export function clearFrameSessions(): void {
  sessions.clear();
  engagedKeys.clear();
}
