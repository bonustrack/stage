import { createA2uiClient, type A2uiClient, type SurfaceNav, type TransportMetadata } from '@stage-labs/kit/a2ui/client';
import { A2UI_VERSION, ERROR_CODES, isJsonObject, type RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { snapshotOfClient } from '@stage-labs/kit/a2ui/snapshot';
import { frameContentSchema, isSurfaceMessage, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';

export interface FrameSessionHost {
  send: (message: RendererMessage, client: A2uiClient, metadata?: TransportMetadata) => void;
  navigate: (nav: SurfaceNav) => void;
  openUrl: (url: string) => void;
}

export type FrameApplied = { kind: 'frame'; frame: FrameContent } | { kind: 'unchanged' } | { kind: 'invalid' };

interface FrameSession {
  frame: FrameContent;
  json: string;
  client: A2uiClient;
  host: FrameSessionHost | null;
  queued: QueuedMessage[];
}

interface QueuedMessage { message: RendererMessage; metadata?: TransportMetadata }

const MAX_QUEUED = 50;

const MAX_SESSIONS = 100;
const sessions = new Map<string, FrameSession>();

export const RENDERER_CAPABILITIES: Record<string, unknown> = { ...createA2uiClient().capabilities() };

function deliver(session: FrameSession | undefined, queued: QueuedMessage): void {
  if (session === undefined) return;
  if (session.host === null) {
    if (session.queued.length < MAX_QUEUED) session.queued.push(queued);
    return;
  }
  session.host.send(queued.message, session.client, queued.metadata);
}

function buildClient(sessionOf: () => FrameSession | undefined): A2uiClient {
  return createA2uiClient({
    send: (message, metadata) => { deliver(sessionOf(), metadata === undefined ? { message } : { message, metadata }); },
    navigate: (nav) => { sessionOf()?.host?.navigate(nav); },
    openUrl: (url) => { sessionOf()?.host?.openUrl(url); },
  });
}

function remember(key: string, session: FrameSession): void {
  sessions.delete(key);
  sessions.set(key, session);
  for (const oldest of sessions.keys()) {
    if (sessions.size <= MAX_SESSIONS) break;
    sessions.delete(oldest);
  }
}

export function frameSession(key: string, frame: FrameContent): A2uiClient {
  const known = sessions.get(key);
  if (known !== undefined && (known.frame === frame || known.json === JSON.stringify(frame))) {
    known.frame = frame;
    return known.client;
  }
  const holder: { session?: FrameSession } = {};
  const client = buildClient(() => holder.session);
  holder.session = { frame, json: JSON.stringify(frame), host: known?.host ?? null, client, queued: [] };
  remember(key, holder.session);
  for (const message of frame.messages) if (isJsonObject(message)) client.receive(message);
  return client;
}

export function setFrameSessionHost(key: string, host: FrameSessionHost): () => void {
  const session = sessions.get(key);
  if (session === undefined) return () => undefined;
  session.host = host;
  const queued = session.queued.splice(0);
  for (const item of queued) host.send(item.message, session.client, item.metadata);
  return () => { if (session.host === host) session.host = null; };
}

function snapshotFrame(session: FrameSession): FrameContent | null {
  const messages = snapshotOfClient(session.client);
  if (messages.length === 0) return null;
  const { start, ...rest } = session.frame;
  const ids = messages.map((m) => ('createSurface' in m ? m.createSurface.surfaceId : ''));
  const parsed = frameContentSchema.safeParse({ ...rest, ...(start !== undefined && ids.includes(start) ? { start } : {}), messages });
  return parsed.success ? parsed.data : null;
}

export function applyToFrameSession(key: string, messages: readonly Record<string, unknown>[]): FrameApplied {
  const session = sessions.get(key);
  if (session === undefined) return { kind: 'invalid' };
  for (const message of messages) if (isJsonObject(message)) session.client.receive(message);
  if (!messages.some(isSurfaceMessage)) return { kind: 'unchanged' };
  const frame = snapshotFrame(session);
  if (frame === null) return { kind: 'invalid' };
  session.frame = frame;
  session.json = JSON.stringify(frame);
  return { kind: 'frame', frame };
}

export function rejectAgentCall(key: string, functionCallId: string): void {
  const error = { code: ERROR_CODES.unknownFunction, message: 'No agent answers functions here.' };
  sessions.get(key)?.client.receive({ version: A2UI_VERSION, agentFunctionResponse: { functionCallId, error } });
}

export function clearFrameSessions(): void {
  sessions.clear();
}
