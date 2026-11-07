import { concatBytes } from 'viem';

const CHUNK_BYTES = 1_000_000;
export const CHUNK_COUNT_KEY = 'chunks';

export interface ObjectStub {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface ObjectNamespace<Id> {
  idFromName(name: string): Id;
  get(id: Id): ObjectStub;
}

export interface ChunkStorage {
  get(keys: string[]): Promise<Map<string, unknown>>;
  put(entries: Record<string, ArrayBuffer | number>): Promise<void>;
}

export function objectNamed<Id>(ns: ObjectNamespace<Id>, name: string): ObjectStub {
  return ns.get(ns.idFromName(name));
}

function chunkKey(index: number, prefix = ''): string {
  return `${prefix}chunk:${index}`;
}

function chunkKeys(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => chunkKey(index, prefix));
}

export async function putChunks(storage: Pick<ChunkStorage, 'put'>, bytes: Uint8Array, prefix = ''): Promise<void> {
  const entries: Record<string, ArrayBuffer | number> = {};
  let count = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
    entries[chunkKey(count, prefix)] = bytes.slice(offset, offset + CHUNK_BYTES).buffer;
    count += 1;
  }
  entries[`${prefix}${CHUNK_COUNT_KEY}`] = count;
  await storage.put(entries);
}

function joined(chunks: Map<string, unknown>, keys: string[]): Uint8Array | null {
  const parts: Uint8Array[] = [];
  for (const key of keys) {
    const part = chunks.get(key);
    if (!(part instanceof ArrayBuffer)) return null;
    parts.push(new Uint8Array(part));
  }
  return concatBytes(parts);
}

async function chunkCount(storage: Pick<ChunkStorage, 'get'>, prefix: string): Promise<number> {
  const countKey = `${prefix}${CHUNK_COUNT_KEY}`;
  const count = (await storage.get([countKey])).get(countKey);
  return typeof count === 'number' && count > 0 ? count : 0;
}

export async function readChunks(storage: Pick<ChunkStorage, 'get'>, prefix = ''): Promise<Uint8Array | null> {
  const count = await chunkCount(storage, prefix);
  if (count < 1) return null;
  const keys = chunkKeys(count, prefix);
  return joined(await storage.get(keys), keys);
}

export async function storedChunkKeys(storage: Pick<ChunkStorage, 'get'>, prefix: string): Promise<string[]> {
  return [`${prefix}${CHUNK_COUNT_KEY}`, ...chunkKeys(await chunkCount(storage, prefix), prefix)];
}

export async function writeChunks(
  storage: Pick<ChunkStorage, 'put'>,
  body: ReadableStream<Uint8Array> | null,
  first: number,
  limit: number,
): Promise<{ count: number; bytes: number } | null> {
  const chunk = new Uint8Array(CHUNK_BYTES);
  let count = first;
  let bytes = 0;
  let filled = 0;
  const flush = async (): Promise<void> => {
    await storage.put({ [chunkKey(count)]: chunk.slice(0, filled).buffer });
    count += 1;
    filled = 0;
  };
  if (body === null) return { count, bytes };
  const reader = body.getReader();
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      return null;
    }
    for (let at = 0; at < next.value.byteLength;) {
      const take = Math.min(CHUNK_BYTES - filled, next.value.byteLength - at);
      chunk.set(next.value.subarray(at, at + take), filled);
      filled += take;
      at += take;
      if (filled === CHUNK_BYTES) await flush();
    }
  }
  if (filled > 0) await flush();
  return { count, bytes };
}

export function chunkStream(storage: Pick<ChunkStorage, 'get'>, count: number): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const key = chunkKey(index);
      const part = (await storage.get([key])).get(key);
      if (!(part instanceof ArrayBuffer)) {
        controller.error(new Error('archive chunk missing'));
        return;
      }
      controller.enqueue(new Uint8Array(part));
      index += 1;
      if (index === count) controller.close();
    },
  });
}
