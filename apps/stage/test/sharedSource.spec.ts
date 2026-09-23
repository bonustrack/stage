import { describe, expect, test } from 'bun:test';
import { makeSharedSource } from '../lib/storeCore';

function harness() {
  const log: string[] = [];
  const emitters = new Map<string, () => void>();
  const subscribe = makeSharedSource<string>((source, emit) => {
    log.push(`open:${source}`);
    emitters.set(source, emit);
    return () => { log.push(`close:${source}`); };
  });
  return { log, emitters, subscribe };
}

describe('makeSharedSource', () => {
  test('one underlying stream serves every listener and closes only when the last one leaves', () => {
    const { log, emitters, subscribe } = harness();
    const seen: string[] = [];
    const offHome = subscribe('client-a', () => { seen.push('home'); });
    const offChat = subscribe('client-a', () => { seen.push('chat'); });
    expect(log).toEqual(['open:client-a']);
    emitters.get('client-a')?.();
    expect(seen).toEqual(['home', 'chat']);
    offChat();
    expect(log).toEqual(['open:client-a']);
    emitters.get('client-a')?.();
    expect(seen).toEqual(['home', 'chat', 'home']);
    offHome();
    expect(log).toEqual(['open:client-a', 'close:client-a']);
  });

  test('a new client replaces the old stream and unsubscribing twice is harmless', () => {
    const { log, subscribe } = harness();
    const off = subscribe('client-a', () => undefined);
    subscribe('client-b', () => undefined);
    expect(log).toEqual(['open:client-a', 'close:client-a', 'open:client-b']);
    off();
    off();
    expect(log).toEqual(['open:client-a', 'close:client-a', 'open:client-b']);
  });
});
