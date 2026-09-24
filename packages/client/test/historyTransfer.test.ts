import { describe, expect, test } from 'bun:test';
import {
  TRANSFER_CODE_LENGTH, chunkedPbkdf2, deriveTransferSecrets, formatTransferCode, noblePbkdf2, normalizeTransferCode,
  transferCodeFromRandom, unwrapTransferArchive, webCryptoPbkdf2, wrapTransferArchive,
} from '../src/xmtp/historyTransfer';

const FAST_ITERATIONS = 1_000;

describe('transfer codes', () => {
  test('encode 50 random bits as 10 Crockford base32 characters', () => {
    expect(transferCodeFromRandom(new Uint8Array(7))).toBe('0000000000');
    expect(transferCodeFromRandom(new Uint8Array(7).fill(255))).toBe('ZZZZZZZZZZ');
    expect(transferCodeFromRandom(Uint8Array.of(0x08, 0x86, 0x42, 0x98, 0xe8, 0x4a, 0x96))).toBe('123456789A');
  });

  test('every generated code is valid, canonical and uses the full alphabet', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const code = transferCodeFromRandom(crypto.getRandomValues(new Uint8Array(7)));
      expect(code).toHaveLength(TRANSFER_CODE_LENGTH);
      expect(normalizeTransferCode(code)).toBe(code);
      for (const char of code) seen.add(char);
    }
    expect(seen.size).toBe(32);
  });

  test('refuses too few random bytes', () => {
    expect(() => transferCodeFromRandom(new Uint8Array(6))).toThrow();
  });

  test('parse case-insensitively with optional dashes, spaces and look-alike letters', () => {
    expect(normalizeTransferCode('k7m2-9qx4-tr')).toBe('K7M29QX4TR');
    expect(normalizeTransferCode(' K7M2 9QX4 TR ')).toBe('K7M29QX4TR');
    expect(normalizeTransferCode('K7M29QX4TR')).toBe('K7M29QX4TR');
    expect(normalizeTransferCode('iloI-L000-00')).toBe('1101100000');
  });

  test('reject wrong lengths and characters outside the alphabet', () => {
    expect(normalizeTransferCode('K7M2-9QX4-T')).toBeNull();
    expect(normalizeTransferCode('K7M2-9QX4-TRX')).toBeNull();
    expect(normalizeTransferCode('K7M2-9QX4-TU')).toBeNull();
    expect(normalizeTransferCode('K7M2-9QX4-T!')).toBeNull();
    expect(normalizeTransferCode('')).toBeNull();
  });

  test('format in groups of four', () => {
    expect(formatTransferCode('K7M29QX4TR')).toBe('K7M2-9QX4-TR');
  });
});

describe('deriveTransferSecrets', () => {
  test('is deterministic and splits the lookup id from the archive key', async () => {
    const first = await deriveTransferSecrets('K7M29QX4TR', noblePbkdf2, FAST_ITERATIONS);
    const second = await deriveTransferSecrets('K7M29QX4TR', noblePbkdf2, FAST_ITERATIONS);
    expect(first.id).toMatch(/^[0-9a-f]{64}$/);
    expect(first.key).toHaveLength(32);
    expect(second).toEqual(first);
    expect(Buffer.from(first.key).toString('hex')).not.toBe(first.id);
  });

  test('matches a vector computed independently with Python hashlib', async () => {
    const secrets = await deriveTransferSecrets('K7M29QX4TR', noblePbkdf2, FAST_ITERATIONS);
    expect(secrets.id).toBe('5dc74fa918b0441ec0f45439c1771340cb094853b758bbca504922ba45f95f59');
    expect(Buffer.from(secrets.key).toString('hex')).toBe('b670761b2b13e5904ac3ccab3192a4cd9926416100b0e226abc94a9a0adcdcdb');
  });

  test('uses the production iteration count by default', async () => {
    const secrets = await deriveTransferSecrets('K7M29QX4TR');
    expect(secrets.id).toBe('f067ba98849292273f2de53c744739ca3cc71cfea9a438ab5da309085aa83789');
  });

  test('web crypto and the pure implementation agree', async () => {
    const pure = await deriveTransferSecrets('ZZZZZZZZZZ', noblePbkdf2, FAST_ITERATIONS);
    const web = await deriveTransferSecrets('ZZZZZZZZZZ', webCryptoPbkdf2(crypto.subtle), FAST_ITERATIONS);
    expect(web).toEqual(pure);
  });

  test('the chunked implementation matches the vector, pauses between chunks and reports progress', async () => {
    let pauses = 0;
    const shares: number[] = [];
    const chunked = chunkedPbkdf2(async () => { pauses += 1; }, (share) => { shares.push(share); }, 100);
    const secrets = await deriveTransferSecrets('K7M29QX4TR', chunked, FAST_ITERATIONS);
    expect(secrets.id).toBe('5dc74fa918b0441ec0f45439c1771340cb094853b758bbca504922ba45f95f59');
    expect(pauses).toBeGreaterThan(0);
    expect(shares.at(-1)).toBe(1);
    expect(shares.every((share, i) => i === 0 || share >= (shares[i - 1] ?? 0))).toBe(true);
  });

  test('a different code gives an unrelated id and key', async () => {
    const a = await deriveTransferSecrets('K7M29QX4TR', noblePbkdf2, FAST_ITERATIONS);
    const b = await deriveTransferSecrets('K7M29QX4TS', noblePbkdf2, FAST_ITERATIONS);
    expect(b.id).not.toBe(a.id);
    expect(b.key).not.toEqual(a.key);
  });
});

describe('transfer envelope', () => {
  test('round-trips the archive bytes', () => {
    const archive = crypto.getRandomValues(new Uint8Array(64));
    const unwrapped = unwrapTransferArchive(wrapTransferArchive(archive));
    expect(unwrapped).toEqual({ ok: true, archive });
  });

  test('flags other versions, foreign bytes and empty archives as incompatible', () => {
    const wrapped = wrapTransferArchive(Uint8Array.of(1, 2, 3));
    const future = Uint8Array.from(wrapped);
    future[4] = 2;
    expect(unwrapTransferArchive(future)).toEqual({ ok: false, reason: 'incompatible' });
    expect(unwrapTransferArchive(Uint8Array.of(0, 1, 2, 3, 4, 5))).toEqual({ ok: false, reason: 'incompatible' });
    expect(unwrapTransferArchive(wrapTransferArchive(new Uint8Array(0)))).toEqual({ ok: false, reason: 'incompatible' });
  });
});
