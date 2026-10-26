const CHUNK = 0x8000;

export function binaryString(codes: Uint8Array | Uint16Array): string {
  let out = '';
  for (let i = 0; i < codes.length; i += CHUNK) out += String.fromCharCode(...codes.subarray(i, i + CHUNK));
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(binaryString(bytes));
}

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToUtf8(b64: string): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(base64ToBytes(b64));
}
