import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { profileRequest } from '../lib/profileFetch';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('profile request deadline', () => {
  test('an unresponsive transport settles even when it ignores abort', async () => {
    const pending = Promise.withResolvers<Response>();
    const fetch = spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise);
    await expect(profileRequest('https://synthetic.invalid', {}, (res) => res.text(), 5)).rejects.toThrow('timed out');
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    pending.resolve(new Response('late'));
  });
  test('a response body cannot outlive the request deadline', async () => {
    const body = Promise.withResolvers<string>();
    spyOn(globalThis, 'fetch').mockResolvedValue(new Response('synthetic'));
    await expect(profileRequest('https://synthetic.invalid', {}, () => body.promise, 5)).rejects.toThrow('timed out');
    body.resolve('late');
  });
  test('successful and failed requests preserve their actual results', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('synthetic'));
    expect(await profileRequest('https://synthetic.invalid', {}, (res) => res.text(), 50)).toBe('synthetic');
    const failure = new Error('offline');
    fetch.mockRejectedValueOnce(failure);
    await expect(profileRequest('https://synthetic.invalid', {}, (res) => res.text(), 50)).rejects.toBe(failure);
  });
});
