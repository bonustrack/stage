import { useRef, useState } from 'react';
import { makeMachine, type Machine } from './machine';

export function useMachine<S, E>(step: (state: S, event: E) => S, initial: S): [state: S, send: (event: E) => boolean] {
  const [state, setState] = useState(initial);
  const machine = useRef<Machine<S, E> | null>(null);
  machine.current ??= makeMachine(step, initial, setState);
  return [state, machine.current.send];
}
