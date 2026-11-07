import { concatBytes } from '@noble/hashes/utils';

export type CapMode = 'truncate' | 'reject';

export function declaredLength(headers: { get(name: string): string | null }): number | null {
  const raw = headers.get('content-length');
  const size = raw === null ? Number.NaN : Number(raw);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

export async function readCappedBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  mode: CapMode,
): Promise<Uint8Array | null> {
  if (body === null) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    if (mode === 'reject' && total + part.value.byteLength > maxBytes) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(part.value);
    total += part.value.byteLength;
    if (mode === 'truncate' && total >= maxBytes) {
      void reader.cancel().catch(() => undefined);
      break;
    }
  }
  return concatBytes(...chunks);
}

export async function readCappedResponse(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if ((declaredLength(response.headers) ?? 0) > maxBytes) return null;
  return readCappedBytes(response.body, maxBytes, 'reject');
}
