import type { AgentCallResult } from './evaluate';
import type { ComponentInstance, JsonObject } from './protocol';

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
