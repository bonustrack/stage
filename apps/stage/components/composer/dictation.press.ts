interface DictationPressActions {
  start(): void;
  stop(): void;
  toggle(): void;
}

export function makeDictationPress(actions: DictationPressActions, holdMs = 350, now = Date.now) {
  let pressed = false;
  let inside = false;
  let holding = false;
  let consumed = false;
  let aborted = false;
  let began = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hold = (): void => {
    if (!pressed || !inside || holding) return;
    holding = true;
    consumed = true;
    actions.start();
  };
  const stop = (): void => {
    clearTimeout(timer);
    if (!holding) return;
    holding = false;
    actions.stop();
  };
  const release = (): void => {
    if (pressed && now() - began >= holdMs) consumed = true;
    pressed = false;
    inside = false;
    stop();
  };
  return {
    pressIn: (physical = true) => {
      if (!physical || (pressed && aborted)) return;
      if (!pressed) { began = now(); consumed = false; aborted = false; }
      pressed = true;
      inside = true;
      clearTimeout(timer);
      if (now() - began >= holdMs) hold();
      else timer = setTimeout(hold, holdMs - (now() - began));
    },
    hold,
    pressOut: () => { inside = false; if (holding) aborted = true; stop(); },
    release,
    cancel: () => { consumed = true; release(); },
    press: (physical: boolean) => {
      const gesture = physical || pressed;
      if (gesture) release();
      if (!gesture || !consumed) actions.toggle();
    },
    reset: () => { clearTimeout(timer); pressed = false; inside = false; holding = false; consumed = false; aborted = false; },
  };
}
