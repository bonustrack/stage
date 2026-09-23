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

  test('payloads reach every listener and a throwing listener does not starve the others', () => {
    const emitters = new Map<string, (value: number) => void>();
    let opens = 0;
    const subscribe = makeSharedSource<string, number>((source, emit) => {
      opens += 1;
      emitters.set(source, emit);
      return () => { emitters.delete(source); };
    });
    const seen: string[] = [];
    const offThrowing = subscribe('client-a', () => { throw new Error('listener failed'); });
    const offA = subscribe('client-a', (n) => { seen.push(`a:${n}`); });
    const offB = subscribe('client-a', (n) => { seen.push(`b:${n}`); });
    emitters.get('client-a')?.(7);
    expect(seen).toEqual(['a:7', 'b:7']);
    expect(opens).toBe(1);
    offThrowing();
    offA();
    expect(emitters.has('client-a')).toBe(true);
    offB();
    expect(emitters.has('client-a')).toBe(false);
    subscribe('client-a', () => undefined);
    expect(opens).toBe(2);
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
