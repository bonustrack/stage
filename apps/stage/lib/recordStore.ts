import { reported } from './errorPolicy';
import { writeBehind, type WritePolicy } from './writeBehind';

type RecordText = () => string | Promise<string>;

export interface RecordStore {
  read(name: string): Promise<string | null>;
  write(name: string, text: RecordText): void;
  remove(name: string): Promise<void>;
}

export interface RecordIo {
  read: (name: string) => Promise<string | null>;
  write: (name: string, text: string | null) => void | Promise<void>;
  onFlushSignal: (flushAll: () => void) => void;
}

export function makeRecordStore(io: RecordIo, policy: WritePolicy, writeErrorTag: string): RecordStore {
  const writing = new Map<string, RecordText>();
  let queue: Promise<void> = Promise.resolve();
  function queued(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task).catch(reported(writeErrorTag));
    return queue;
  }
  const writes = writeBehind<RecordText>(policy, (name, text) => {
    writing.set(name, text);
    void queued(async () => {
      try {
        await io.write(name, await text());
      } finally {
        if (writing.get(name) === text) writing.delete(name);
      }
    });
  });
  const latest = (name: string): RecordText | undefined => writes.peek(name)?.value ?? writing.get(name);
  io.onFlushSignal(writes.flushAll);
  return {
    async read(name) {
      const pending = latest(name);
      if (pending !== undefined) return pending();
      const stored = await io.read(name);
      const written = latest(name);
      return written === undefined ? stored : written();
    },
    write: writes.set,
    remove(name) {
      writes.drop(name);
      writing.delete(name);
      return queued(async () => {
        await io.write(name, null);
      });
    },
  };
}
