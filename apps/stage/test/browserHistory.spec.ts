import { afterEach, describe, expect, test } from 'bun:test';
import { createMemoryHistory } from 'expo-router/build/fork/createMemoryHistory';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');

afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['location', originalLocation]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function browserHistory() {
  const events = new EventTarget();
  const entries: { state: { id: string } | undefined; path: string }[] = [{ state: undefined, path: '/#/' }];
  let index = 0;
  const browser = {
    history: {
      get state() { return entries[index]?.state; },
      pushState(state: { id: string }, _title: string, path: string) {
        entries.splice(index + 1, entries.length, { state, path });
        index += 1;
      },
      replaceState(state: { id: string }, _title: string, path: string) {
        entries[index] = { state, path };
      },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { hash: '' }, configurable: true });
  return {
    popTo(next: number) {
      index = next;
      events.dispatchEvent(new Event('popstate'));
    },
  };
}

function record(name: string) {
  return {
    path: `/#/${name}`,
    state: { stale: false as const, type: 'stack', key: 'root', index: 0, routeNames: [name], routes: [{ key: name, name }] },
  };
}

function setup() {
  const browser = browserHistory();
  const history = createMemoryHistory();
  history.replace(record('home'));
  history.push(record('alpha'));
  history.push(record('beta'));
  return { browser, history };
}

describe('browser history popstate synchronization', () => {
  test('Back updates the current record without overwriting Forward entries', () => {
    const { browser, history } = setup();
    const stop = history.listen(() => {
      const current = history.get(history.index);
      if (current) history.replace(current);
    });
    browser.popTo(1);
    browser.popTo(0);
    expect(history.get(0)?.path).toBe('/#/home');
    expect(history.get(1)?.path).toBe('/#/alpha');
    expect(history.get(2)?.path).toBe('/#/beta');
    browser.popTo(1);
    expect(history.get(history.index)?.path).toBe('/#/alpha');
    stop();
  });

  test('new navigation after Back discards the old forward branch', () => {
    const { browser, history } = setup();
    let popCount = 0;
    const stop = history.listen(() => { popCount += 1; });
    browser.popTo(1);
    expect(popCount).toBe(1);
    expect(history.backIndex({ path: '/#/home' })).toBe(0);
    history.push(record('gamma'));
    expect(history.index).toBe(2);
    expect(history.get(2)?.path).toBe('/#/gamma');
    expect(history.get(3)).toBeUndefined();
    stop();
  });
});
