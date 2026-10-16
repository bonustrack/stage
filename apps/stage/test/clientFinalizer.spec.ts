import { describe, expect, test } from 'bun:test';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { makeClientFinalizer, openFinalizedClient, type FinalizeDeps } from '../lib/xmtp.finalize.core';

const account = (id: string): AccountRecord => ({ id, address: `0x${id}`, type: 'generated', dbDir: id, createdAt: 0 });

function harness(overrides: Partial<FinalizeDeps<string>> = {}) {
  let selected = 'a';
  const log: string[] = [];
  const deps: FinalizeDeps<string> = {
    active: () => Promise.resolve(account(selected)),
    markRegistered: (id) => { log.push(`registered:${id}`); return Promise.resolve(undefined); },
    saveEnv: () => { log.push('env'); return Promise.resolve(undefined); },
    discard: (client) => { log.push(`discard:${client}`); },
    ...overrides,
  };
  return { finalize: makeClientFinalizer(deps), log, selected: () => selected, select: (id: string) => { selected = id; } };
}

describe('client finalization', () => {
  for (const boundary of ['markRegistered', 'saveEnv'] as const) {
    test(`a failed ${boundary} does not publish readiness and discards only its own client`, async () => {
      const failure = new Error(boundary);
      const { finalize, log } = harness({ [boundary]: () => Promise.reject(failure) });
      await expect(finalize('client-a', account('a'), 'production', { markRegistered: true })).rejects.toBe(failure);
      expect(log.filter(e => e.startsWith('cache:') || e.startsWith('push:'))).toEqual([]);
      expect(log.filter(e => e.startsWith('discard:'))).toEqual(['discard:client-a']);
    });
  }

  test('a selection change during registration cannot restore the old account or publish its client', async () => {
    const entered = Promise.withResolvers<undefined>();
    const persistence = Promise.withResolvers<undefined>();
    const h = harness({ markRegistered: () => { entered.resolve(undefined); return persistence.promise; } });
    const opening = h.finalize('client-a', account('a'), 'production', { markRegistered: true });
    const result = opening.catch((e: unknown) => e);
    await entered.promise;
    h.select('b');
    persistence.resolve(undefined);
    expect(await result).toBeInstanceOf(Error);
    await expect(opening).rejects.toThrow('account changed');
    expect(h.selected()).toBe('b');
    expect(h.log).toEqual(['discard:client-a']);
  });

  test('failed selected-account reads are not treated as authorization to initialize', async () => {
    const failure = new Error('account storage failed');
    const { finalize, log } = harness({ active: () => Promise.reject(failure) });
    await expect(finalize('client-a', account('a'), 'production', { markRegistered: true })).rejects.toBe(failure);
    expect(log).toEqual(['discard:client-a']);
  });

  for (const boundary of ['active', 'markRegistered', 'saveEnv'] as const) {
    test(`offline finalization ${boundary} failure never deletes saved metadata or reopens online`, async () => {
      const failure = new Error(`${boundary} unavailable`);
      const h = harness({ [boundary]: () => Promise.reject(failure) });
      const opening = openFinalizedClient({
        open: () => Promise.resolve('offline-client'),
        canFallback: () => true,
        fallback: () => { h.log.push('delete-inbox', 'online-open'); return Promise.resolve('online-client'); },
        finalize: client => h.finalize(client, account('a'), 'production', { markRegistered: true }),
      });
      await expect(opening).rejects.toBe(failure);
      expect(h.log).not.toContain('delete-inbox');
      expect(h.log).not.toContain('online-open');
      expect(h.log.filter(value => value.startsWith('discard:'))).toEqual(['discard:offline-client']);
    });
  }

  test('a genuine permitted offline open failure still falls back once before finalization', async () => {
    const events: string[] = [];
    expect(await openFinalizedClient({
      open: () => { events.push('offline'); return Promise.reject(new Error('offline open failed')); },
      canFallback: () => true,
      fallback: () => { events.push('online'); return Promise.resolve('client'); },
      finalize: client => { events.push(`finalize:${client}`); return Promise.resolve(client); },
    })).toBe('client');
    expect(events).toEqual(['offline', 'online', 'finalize:client']);
  });

  test('successful finalization never reselects an account', async () => {
    const { finalize, log } = harness();
    expect(await finalize('client-a', account('a'), 'production', { markRegistered: true })).toBe('client-a');
    expect(log).toEqual(['registered:a', 'env']);
  });
});
