import { describe, expect, test } from 'bun:test';
import {
  resolveSwarmyResponse, swarmToHttp, tooLargeError,
  SWARM_GATEWAY, SWARM_UPLOAD_MAX_BYTES,
} from '../lib/swarmy';
import { retypeFilename } from '../lib/attachmentImage.web';

const NGINX_BODY_CAP = 1024 * 1024;

describe('resolveSwarmyResponse', () => {
  test('returns the gateway url with trailing slash on success', () => {
    const ref = 'aa902c7392044a6492c5664b05364db15e7ae7bbc75fd505cd8b1a20f7389845';
    expect(resolveSwarmyResponse(200, { swarmReference: ref }, 'a.png')).toBe(`${SWARM_GATEWAY}${ref}/`);
    expect(resolveSwarmyResponse(201, { swarmReference: ref }, 'a.png')).toBe(`${SWARM_GATEWAY}${ref}/`);
  });

  test('maps 413 to a clear too-large message', () => {
    expect(() => resolveSwarmyResponse(413, null, 'big.mov')).toThrow(/too large to send \(server max/);
  });

  test('maps auth failures to a rejected message', () => {
    expect(() => resolveSwarmyResponse(401, null, 'a.png')).toThrow(/rejected the request/);
    expect(() => resolveSwarmyResponse(403, null, 'a.png')).toThrow(/rejected the request/);
  });

  test('maps other non-2xx to a failure message carrying the status', () => {
    expect(() => resolveSwarmyResponse(502, null, 'a.png')).toThrow(/upload failed \(502\)/);
  });

  test('throws when a 2xx response carries no reference', () => {
    expect(() => resolveSwarmyResponse(200, {}, 'a.png')).toThrow(/returned no reference/);
    expect(() => resolveSwarmyResponse(200, null, 'a.png')).toThrow(/returned no reference/);
  });

  test('never mentions the dead blob.stage.box proxy host', () => {
    let msg = '';
    try { resolveSwarmyResponse(500, null, 'a.png'); } catch (e) { msg = String(e); }
    expect(msg).not.toContain('blob.stage.box');
  });
});

describe('the client-side size guard matches what the upload host actually accepts', () => {
  test('the cap sits under the 1MiB nginx body limit, with room for multipart overhead', () => {
    expect(SWARM_UPLOAD_MAX_BYTES).toBeLessThan(NGINX_BODY_CAP);
    expect(NGINX_BODY_CAP - SWARM_UPLOAD_MAX_BYTES).toBeGreaterThan(4096);
  });

  test('the cap is still large enough to be useful for a compressed photo', () => {
    expect(SWARM_UPLOAD_MAX_BYTES).toBeGreaterThan(512 * 1024);
  });

  test('an oversized file is refused up front with a readable limit', () => {
    expect(tooLargeError('big.png').message).toMatch(/too large to send \(max ~1MB\)/);
  });
});

describe('retypeFilename', () => {
  test('rewrites the extension when an image is re-encoded', () => {
    expect(retypeFilename('photo.png', 'image/webp')).toBe('photo.webp');
    expect(retypeFilename('photo.png', 'image/jpeg')).toBe('photo.jpg');
  });

  test('keeps the name when the type is unchanged or unknown', () => {
    expect(retypeFilename('photo.png', 'image/png')).toBe('photo.png');
    expect(retypeFilename('notes.pdf', 'application/pdf')).toBe('notes.pdf');
  });

  test('handles dotted and extensionless names without mangling them', () => {
    expect(retypeFilename('my.holiday.photo.png', 'image/webp')).toBe('my.holiday.photo.webp');
    expect(retypeFilename('screenshot', 'image/webp')).toBe('screenshot.webp');
    expect(retypeFilename('.hidden', 'image/webp')).toBe('.hidden.webp');
  });
});

describe('swarmToHttp', () => {
  test('rewrites a swarm:// ref to the swarmy bzz gateway', () => {
    expect(swarmToHttp('swarm://abc123')).toBe(`${SWARM_GATEWAY}abc123/`);
    expect(swarmToHttp('swarm://abc123///')).toBe(`${SWARM_GATEWAY}abc123/`);
  });

  test('passes through non-swarm urls unchanged', () => {
    expect(swarmToHttp('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
});
