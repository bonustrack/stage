export interface StoredPasskey {
  pubX: string;
  pubY: string;
  authenticatorId: string;
  authenticatorIdHash: string;
  rpID: string;
}

export interface RegisterPasskeyOptions {
  rpId: string;
  userName: string;
  userDisplayName?: string;
}

export function effectiveRpId(configured: string, hostname: string): string {
  if (hostname === configured || hostname.endsWith(`.${configured}`)) return configured;
  return hostname;
}

export function bytesToStandardBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToStandardBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.codePointAt(0) ?? 0);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function decodeClientDataJson(b64url: string): string {
  return new TextDecoder().decode(base64UrlToBytes(b64url));
}

export function signableMessageToHex(message: unknown): string {
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null && 'raw' in message) {
    const raw = message.raw;
    if (typeof raw === 'string') return raw;
    if (raw instanceof Uint8Array) return bytesToHex(raw);
  }
  throw new Error('Unsupported message format');
}

interface ResponseWithDerKey {
  getPublicKey: () => ArrayBuffer | null;
}

function derPublicKeyOf(response: Record<string, unknown>): ArrayBuffer | null {
  if (typeof response.getPublicKey !== 'function') return null;
  return (response as unknown as ResponseWithDerKey).getPublicKey();
}

export function normalizeRegistrationPublicKey(cred: unknown): unknown {
  if (typeof cred !== 'object' || cred === null) return cred;
  const record = cred as Record<string, unknown>;
  if (typeof record.response !== 'object' || record.response === null) return cred;
  const response = record.response as Record<string, unknown>;
  if (typeof response.publicKey === 'string') return cred;
  const der = derPublicKeyOf(response);
  if (!der) return cred;
  return {
    ...record,
    response: { ...response, publicKey: bytesToStandardBase64(new Uint8Array(der)) },
  };
}
