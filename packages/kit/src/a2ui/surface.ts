import type { AgentCallResult } from './evaluate';
import type { ComponentInstance, JsonObject, JsonValue } from './protocol';

export interface AgentCall extends AgentCallResult {
  functionCallId: string;
}

export interface SurfaceState {
  id: string;
  catalogId: string | undefined;
  sendDataModel: boolean;
  metadata: JsonObject | undefined;
  components: Map<string, ComponentInstance>;
  data: JsonObject;
  version: number;
  agentCalls: Map<string, AgentCall>;
  reported: Set<string>;
}

export function createSurfaceState(id: string, catalogId: string | undefined, sendDataModel: boolean, metadata: JsonObject | undefined): SurfaceState {
  return {
    id,
    catalogId,
    sendDataModel,
    metadata,
    components: new Map(),
    data: {},
    version: 0,
    agentCalls: new Map(),
    reported: new Set(),
  };
}

export type Listener = () => void;

export interface SurfaceEvents {
  emit: (surfaceId: string) => void;
  subscribe: (surfaceId: string | null, listener: Listener) => () => void;
}

export function createSurfaceEvents(): SurfaceEvents {
  const bySurface = new Map<string | null, Set<Listener>>();
  const listenersOf = (key: string | null): Set<Listener> => {
    const existing = bySurface.get(key);
    if (existing !== undefined) return existing;
    const created = new Set<Listener>();
    bySurface.set(key, created);
    return created;
  };
  return {
    emit(surfaceId) {
      for (const listener of [...listenersOf(surfaceId), ...listenersOf(null)]) listener();
    },
    subscribe(surfaceId, listener) {
      const set = listenersOf(surfaceId);
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}

export function stableKey(value: JsonValue | Record<string, unknown>): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => stableKey(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  const record: Record<string, unknown> = value;
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableKey((record[k] ?? null) as JsonValue)}`).join(',')}}`;
}
