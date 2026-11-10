import { describe, expect, test } from 'bun:test';
import { makeMachine } from '../lib/machine';

type Door = 'open' | 'closed';

function door(state: Door, event: 'open' | 'close'): Door {
  if (event === 'open') return 'open';
  return state === 'open' ? 'closed' : state;
}

describe('makeMachine', () => {
  test('send says whether the event changed the state', () => {
    const machine = makeMachine(door, 'closed' as Door);
    expect(machine.send('close')).toBe(false);
    expect(machine.send('open')).toBe(true);
    expect(machine.get()).toBe('open');
  });

  test('a second identical event in the same tick is refused before any render', () => {
    const seen: Door[] = [];
    const machine = makeMachine(door, 'closed' as Door, (state) => seen.push(state));
    expect([machine.send('open'), machine.send('open')]).toEqual([true, false]);
    expect(seen).toEqual(['open']);
  });
});
