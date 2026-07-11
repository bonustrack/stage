
import { describe, expect, test } from 'bun:test';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToStandardBase64,
  decodeClientDataJson,
  effectiveRpId,
  hexToBytes,
  hostSupportsRpId,
  normalizeRegistrationPublicKey,
  signableMessageToHex,
} from '../lib/zerodev/passkeys.model';

describe('hostSupportsRpId — passkeys only on the rpId family or local dev hosts', () => {
  test('production host and subdomains are supported', () => {
    expect(hostSupportsRpId('stage.box', 'stage.box')).toBe(true);
    expect(hostSupportsRpId('stage.box', 'dev.stage.box')).toBe(true);
  });
  test('local dev hosts are supported', () => {
    expect(hostSupportsRpId('stage.box', 'localhost')).toBe(true);
    expect(hostSupportsRpId('stage.box', '127.0.0.1')).toBe(true);
  });
  test('ephemeral preview hosts are NOT supported (would mint an unusable on-chain credential)', () => {
    expect(hostSupportsRpId('stage.box', 'deploy-preview-12--stage.netlify.app')).toBe(false);
  });
  test('lookalike domains are NOT supported', () => {
    expect(hostSupportsRpId('stage.box', 'evilstage.box')).toBe(false);
  });
});

describe('effectiveRpId — configured rpId inside its family, hostname on local dev', () => {
  test('exact production host keeps the configured rpId', () => {
    expect(effectiveRpId('stage.box', 'stage.box')).toBe('stage.box');
  });
  test('subdomain keeps the configured rpId (registrable suffix)', () => {
    expect(effectiveRpId('stage.box', 'dev.stage.box')).toBe('stage.box');
  });
  test('localhost dev server registers against localhost', () => {
    expect(effectiveRpId('stage.box', 'localhost')).toBe('localhost');
  });
});

describe('base64url helpers — round-trips and url-unsafe characters', () => {
  test('bytesToBase64Url emits -/_ and no padding', () => {
    const bytes = Uint8Array.from([251, 239, 190, 62, 63, 255]);
    const b64url = bytesToBase64Url(bytes);
    expect(b64url).not.toMatch(/[+/=]/);
    expect(base64UrlToBytes(b64url)).toEqual(bytes);
  });
  test('base64UrlToBytes accepts unpadded base64url', () => {
    expect(Array.from(base64UrlToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(base64UrlToBytes('_-8'))).toEqual([255, 239]);
  });
  test('hexToBytes handles 0x-prefixed and bare hex', () => {
    expect(Array.from(hexToBytes('0xdeadbeef'))).toEqual([222, 173, 190, 239]);
    expect(Array.from(hexToBytes('00ff'))).toEqual([0, 255]);
  });
  test('decodeClientDataJson decodes base64url that would crash atob', () => {
    const json = '{"type":"webauthn.get","challenge":">>?","origin":"https://stage.box"}';
    const b64url = bytesToBase64Url(new TextEncoder().encode(json));
    expect(b64url).toMatch(/[-_]/);
    expect(decodeClientDataJson(b64url)).toBe(json);
  });
});

describe('signableMessageToHex — mirrors the native callback message contract', () => {
  test('plain string passes through', () => {
    expect(signableMessageToHex('0xabcdef')).toBe('0xabcdef');
  });
  test('raw hex string passes through', () => {
    expect(signableMessageToHex({ raw: '0x1234' })).toBe('0x1234');
  });
  test('raw bytes become bare hex', () => {
    expect(signableMessageToHex({ raw: Uint8Array.from([18, 52]) })).toBe('1234');
  });
  test('unsupported shapes throw', () => {
    expect(() => signableMessageToHex(42)).toThrow('Unsupported message format');
  });
});

describe('normalizeRegistrationPublicKey — web getPublicKey() to base64 publicKey', () => {
  const der = Uint8Array.from([48, 89, 48, 19]);
  test('adds response.publicKey from getPublicKey() as standard base64', () => {
    const cred = {
      id: 'cred-id',
      response: {
        clientDataJSON: 'x',
        getPublicKey: () => der.buffer,
      },
    };
    const out = normalizeRegistrationPublicKey(cred) as {
      response: { publicKey?: string };
    };
    expect(out.response.publicKey).toBe(bytesToStandardBase64(der));
  });
  test('keeps an existing string publicKey untouched (native shape)', () => {
    const cred = { response: { publicKey: 'already-there' } };
    expect(normalizeRegistrationPublicKey(cred)).toBe(cred);
  });
  test('returns input unchanged when getPublicKey yields null', () => {
    const cred = { response: { getPublicKey: () => null } };
    expect(normalizeRegistrationPublicKey(cred)).toBe(cred);
  });
  test('returns input unchanged for non-credential shapes', () => {
    expect(normalizeRegistrationPublicKey(null)).toBe(null);
    expect(normalizeRegistrationPublicKey('nope')).toBe('nope');
  });
});
