import type { CatalogRegistry } from './catalog';
import type { AgentCallResult, Diagnostic } from './evaluate';
import type { FunctionImpl } from './functions';
import { A2UI_VERSION, type FunctionResponse, type JsonObject, type RendererMessage } from './protocol';
import { stableKey, type SurfaceEvents, type SurfaceState } from './surface';

export interface ClientContext {
  catalogs: readonly JsonObject[];
  registry: CatalogRegistry;
  events: SurfaceEvents;
  surfaces: Map<string, SurfaceState>;
  functions: (catalogId: string) => Record<string, FunctionImpl> | undefined;
  send: (message: RendererMessage, surfaceId?: string) => void;
  diagnose: (diagnostic: Diagnostic, surfaceId?: string) => void;
}

export interface AgentCalls {
  callAgent: (surface: SurfaceState | undefined) => (catalogId: string, name: string, args: Record<string, unknown>) => AgentCallResult;
  resolveAgentCall: (response: FunctionResponse) => void;
}

export function createAgentCalls(ctx: ClientContext): AgentCalls {
  const pending = new Map<string, { surfaceId: string; key: string }>();
  let counter = 0;
  const nextId = (surfaceId: string): string => {
    counter += 1;
    return `${surfaceId}.${Date.now().toString(36)}.${counter}`;
  };
  return {
    callAgent: (surface) => (catalogId, name, args) => {
      if (surface === undefined) return { pending: false, error: `Function '${name}' is not available here.` };
      const key = stableKey({ catalogId, name, args });
      const known = surface.agentCalls.get(key);
      if (known !== undefined) return known;
      const functionCallId = nextId(surface.id);
      surface.agentCalls.set(key, { functionCallId, pending: true });
      pending.set(functionCallId, { surfaceId: surface.id, key });
      const callFunction = { '@call': name, catalogId, args: JSON.parse(JSON.stringify(args)) as JsonObject };
      ctx.send({ version: A2UI_VERSION, callAgentFunction: { surfaceId: surface.id, functionCallId, callFunction } }, surface.id);
      return { pending: true };
    },
    resolveAgentCall: (response) => {
      const entry = pending.get(response.functionCallId);
      const surface = entry === undefined ? undefined : ctx.surfaces.get(entry.surfaceId);
      if (entry === undefined || surface === undefined) return;
      pending.delete(response.functionCallId);
      const error = response.error === undefined ? undefined : `${response.error.code}: ${response.error.message}`;
      surface.agentCalls.set(entry.key, { functionCallId: response.functionCallId, pending: false, value: response.value, error });
      surface.version += 1;
      ctx.events.emit(surface.id);
    },
  };
}
