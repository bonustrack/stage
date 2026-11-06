import { mock } from 'bun:test';
import type { AppStorage } from '../platform/types';

interface StorageFaults {
  read?: (key: string) => Promise<void> | void;
  write?: (key: string) => void;
}

export interface MemoryStorage {
  values: Map<string, string>;
  writes: string[];
}

export function mockAppStorage(faults: StorageFaults = {}): MemoryStorage {
  const values = new Map<string, string>();
  const writes: string[] = [];
  const appStorage: AppStorage = {
    get: async (key) => {
      await faults.read?.(key);
      return values.get(key) ?? null;
    },
    set: async (key, value) => {
      faults.write?.(key);
      writes.push(key);
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
  };
  mock.module('../platform/storage', () => ({ appStorage, secureStorage: {} }));
  return { values, writes };
}
