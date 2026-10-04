import { describe, expect, test } from 'bun:test';
import { makeSeenCheck } from '../components/conversation/markRead.model';

function setup(initial: boolean) {
  let seen = initial;
  let marks = 0;
  const check = makeSeenCheck(() => seen, () => { marks += 1; });
  return { check, set: (next: boolean) => { seen = next; }, marks: () => marks };
}

describe('makeSeenCheck', () => {
  test('marks at once when the chat is already seen', () => {
    const s = setup(true);
    s.check();
    expect(s.marks()).toBe(1);
  });

  test('never marks while the app is in the background or the tab is not in front', () => {
    const s = setup(false);
    s.check();
    s.check();
    expect(s.marks()).toBe(0);
  });

  test('marks once when the app comes back to the front, not on every event', () => {
    const s = setup(false);
    s.check();
    s.set(true);
    s.check();
    s.check();
    expect(s.marks()).toBe(1);
    s.set(false);
    s.check();
    s.set(true);
    s.check();
    expect(s.marks()).toBe(2);
  });
});
