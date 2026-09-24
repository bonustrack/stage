import { hmac } from '@noble/hashes/hmac';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils';

export const TRANSFER_CODE_LENGTH = 10;
export const TRANSFER_CODE_RANDOM_BYTES = 7;
export const TRANSFER_KDF_ITERATIONS = 200_000;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LOOKALIKES: Record<string, string> = { I: '1', L: '1', O: '0' };
const BITS_PER_CHAR = 5;
const CANONICAL_CODE = new RegExp(`^[${CROCKFORD}]{${TRANSFER_CODE_LENGTH}}$`);
const KDF_SALT = utf8ToBytes('stage.box/history-transfer/v1');
const ID_LABEL = utf8ToBytes('stage.box/history-transfer/id');
const KEY_LABEL = utf8ToBytes('stage.box/history-transfer/key');
const ENVELOPE_MAGIC = utf8ToBytes('STGH');
const ENVELOPE_VERSION = 1;
const ENVELOPE_HEADER = ENVELOPE_MAGIC.length + 1;

export type Pbkdf2 = (password: Uint8Array, salt: Uint8Array, iterations: number) => Promise<Uint8Array>;

export interface TransferSecrets {
  id: string;
  key: Uint8Array;
}

export type UnwrappedTransfer = { ok: true; archive: Uint8Array } | { ok: false; reason: 'incompatible' };

export function transferCodeFromRandom(bytes: Uint8Array): string {
  if (bytes.length < TRANSFER_CODE_RANDOM_BYTES) throw new Error('A transfer code needs 7 random bytes.');
  let code = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes.subarray(0, TRANSFER_CODE_RANDOM_BYTES)) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= BITS_PER_CHAR && code.length < TRANSFER_CODE_LENGTH) {
      bits -= BITS_PER_CHAR;
      code += CROCKFORD.charAt((buffer >> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }
  return code;
}

export function normalizeTransferCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[ILO]/g, (char) => LOOKALIKES[char] ?? char);
  return CANONICAL_CODE.test(code) ? code : null;
}

export function formatTransferCode(code: string): string {
  return [code.slice(0, 4), code.slice(4, 8), code.slice(8)].filter((part) => part !== '').join('-');
}

export const noblePbkdf2: Pbkdf2 = (password, salt, iterations) =>
  pbkdf2Async(sha256, password, salt, { c: iterations, dkLen: 32 });

export function chunkedPbkdf2(
  pause: () => Promise<void>, onProgress: (share: number) => void = () => undefined, chunk = 2_000,
): Pbkdf2 {
  return async (password, salt, iterations) => {
    const prf = hmac.create(sha256, password);
    let block = prf.clone().update(concatBytes(salt, Uint8Array.of(0, 0, 0, 1))).digest();
    const out = block.slice();
    for (let i = 1; i < iterations; i += 1) {
      block = prf.clone().update(block).digest();
      for (let j = 0; j < out.length; j += 1) out[j] = (out[j] ?? 0) ^ (block[j] ?? 0);
      if (i % chunk === 0) {
        onProgress(i / iterations);
        await pause();
      }
    }
    onProgress(1);
    return out;
  };
}

export function webCryptoPbkdf2(subtle: SubtleCrypto): Pbkdf2 {
  return async (password, salt, iterations) => {
    const material = await subtle.importKey('raw', new Uint8Array(password), 'PBKDF2', false, ['deriveBits']);
    const params = { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations };
    return new Uint8Array(await subtle.deriveBits(params, material, 256));
  };
}

export function defaultPbkdf2(): Pbkdf2 {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  return subtle === undefined ? noblePbkdf2 : webCryptoPbkdf2(subtle);
}

export async function deriveTransferSecrets(
  code: string, pbkdf2: Pbkdf2 = defaultPbkdf2(), iterations = TRANSFER_KDF_ITERATIONS,
): Promise<TransferSecrets> {
  const master = await pbkdf2(utf8ToBytes(code), KDF_SALT, iterations);
  return {
    id: bytesToHex(sha256(concatBytes(ID_LABEL, master))),
    key: sha256(concatBytes(KEY_LABEL, master)),
  };
}

export function wrapTransferArchive(archive: Uint8Array): Uint8Array {
  return concatBytes(ENVELOPE_MAGIC, Uint8Array.of(ENVELOPE_VERSION), archive);
}

export function unwrapTransferArchive(bytes: Uint8Array): UnwrappedTransfer {
  const magicMatches = ENVELOPE_MAGIC.every((byte, index) => bytes[index] === byte);
  if (!magicMatches || bytes[ENVELOPE_MAGIC.length] !== ENVELOPE_VERSION || bytes.length <= ENVELOPE_HEADER) {
    return { ok: false, reason: 'incompatible' };
  }
  return { ok: true, archive: bytes.subarray(ENVELOPE_HEADER) };
}
