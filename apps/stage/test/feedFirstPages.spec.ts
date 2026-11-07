import { describe, expect, test } from 'bun:test';
import { afterFirstPages, trackFirstPageLoad } from '../lib/feed/firstPages';

describe('startup lists wait for the opened channel', () => {
  test('nothing to wait for when no first page is loading', async () => {
    const started = Date.now();
    await afterFirstPages(1000);
    expect(Date.now() - started).toBeLessThan(100);
  });

  test('waits until the loading first page settles, failures included', async () => {
    const page = Promise.withResolvers<undefined>();
    void trackFirstPageLoad(page.promise);
    const failed = trackFirstPageLoad(Promise.reject(new Error('offline')));
    await failed.catch(() => undefined);
    let released = false;
    const waiting = afterFirstPages(1000).then(() => {
      released = true;
    });
    await Bun.sleep(20);
    expect(released).toBe(false);
    page.resolve(undefined);
    await waiting;
    expect(released).toBe(true);
  });

  test('gives up after the cap', async () => {
    void trackFirstPageLoad(Bun.sleep(200));
    const started = Date.now();
    await afterFirstPages(30);
    const waited = Date.now() - started;
    expect(waited).toBeGreaterThanOrEqual(25);
    expect(waited).toBeLessThan(150);
  });
});
