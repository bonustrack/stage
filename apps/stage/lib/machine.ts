export interface Machine<S, E> {
  get: () => S;
  send: (event: E) => boolean;
}

export function makeMachine<S, E>(step: (state: S, event: E) => S, initial: S, onChange?: (state: S) => void): Machine<S, E> {
  let state = initial;
  return {
    get: () => state,
    send: (event) => {
      const next = step(state, event);
      if (next === state) return false;
      state = next;
      onChange?.(next);
      return true;
    },
  };
}
