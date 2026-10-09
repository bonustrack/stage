import { describe, expect, test } from 'bun:test';
import { assertUploadSize, attachmentDownloadUrl, MAX_UPLOAD_BYTES, resolveUploadResponse } from '../lib/attachmentStorage';

const STORED_ID = 'Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3Jh';
const STORED_URL = `https://proxy.stage.box/attachments/${STORED_ID}`;

describe('resolveUploadResponse', () => {
  test('builds the download link from the returned id and the proxy base', () => {
    expect(resolveUploadResponse(200, { id: STORED_ID }, 'a.pdf')).toBe(STORED_URL);
    expect(resolveUploadResponse(201, { id: STORED_ID }, 'a.pdf')).toBe(STORED_URL);
  });

  test('explains a file that is too large', () => {
    expect(() => resolveUploadResponse(413, null, 'big.mov')).toThrow(
      'Couldn\'t send "big.mov": the file is too large (413). Try a smaller file.',
    );
  });

  test('explains a rate limit', () => {
    expect(() => resolveUploadResponse(429, null, 'a.png')).toThrow(/too many uploads/);
  });

  test('reports other failures with the status', () => {
    expect(() => resolveUploadResponse(502, null, 'a.png')).toThrow(/upload failed \(502\)/);
  });

  test('rejects a 2xx answer without an id', () => {
    expect(() => resolveUploadResponse(200, {}, 'a.png')).toThrow(/returned no id/);
    expect(() => resolveUploadResponse(200, null, 'a.png')).toThrow(/returned no id/);
  });
});

describe('assertUploadSize', () => {
  test('refuses a file over 100 MB before any upload, with the size message', () => {
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES, 'a.mov')).not.toThrow();
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES + 1, 'a.mov')).toThrow(
      'Couldn\'t send "a.mov": the file is too large (over 100 MB). Try a smaller file.',
    );
  });
});

describe('attachmentDownloadUrl', () => {
  const ref = 'ab'.repeat(32);
  const gateway = `https://download.gateway.ethswarm.org/bzz/${ref}/`;

  test('reads an old Swarm link from the public Swarm gateway only', () => {
    expect(attachmentDownloadUrl(`https://old-storage.example/bzz/${ref}/`)).toBe(gateway);
    expect(attachmentDownloadUrl(`https://old-storage.example/bzz/${ref.toUpperCase()}`)).toBe(gateway);
    expect(attachmentDownloadUrl(`swarm://${ref}`)).toBe(gateway);
    expect(attachmentDownloadUrl(`swarm://${ref}///`)).toBe(gateway);
    expect(attachmentDownloadUrl(gateway)).toBe(gateway);
  });

  test('keeps a proxy link or any other url as it is', () => {
    expect(attachmentDownloadUrl(STORED_URL)).toBe(STORED_URL);
    expect(attachmentDownloadUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
    expect(attachmentDownloadUrl('https://example.com/bzz/short')).toBe('https://example.com/bzz/short');
  });
});
