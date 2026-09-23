import type { NamesStore } from './namesTypes.ts';

export const CLAIMS_OBJECT_NAME = 'claims';

export function serialized(run: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  let queue: Promise<unknown> = Promise.resolve();
  return (request) => {
    const next = queue.then(() => run(request));
    queue = next.catch(() => undefined);
    return next;
  };
}

export interface ClaimsStorage {
  get(key: string): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export function claimsStore(storage: ClaimsStorage, mirror: NamesStore): NamesStore {
  return {
    get: async (key) => {
      const own = await storage.get(key);
      if (typeof own !== 'string') return mirror.get(key);
      return own === '' ? null : own;
    },
    put: async (key, value) => {
      await storage.put(key, value);
      await mirror.put(key, value);
    },
  };
}
