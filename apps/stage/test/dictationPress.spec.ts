import { describe, expect, it } from 'bun:test';
import { makeDictationPress } from '../components/composer/dictation.press';

function harness(holdMs = 350, now = Date.now) {
  const events: string[] = [];
  const press = makeDictationPress({
    start: () => { events.push('start'); },
    stop: () => { events.push('stop'); },
    toggle: () => { events.push('toggle'); },
  }, holdMs, now);
  return { events, press };
}

describe('dictation mic gestures', () => {
  it('uses a short tap as toggle without starting while the finger is down', () => {
    const h = harness();
    h.press.pressIn();
    expect(h.events).toEqual([]);
    h.press.release();
    h.press.press(true);
    expect(h.events).toEqual(['toggle']);
  });

  it('completes physical clicks even without a separate touch-end callback', () => {
    let time = 0;
    const h = harness(350, () => time);
    h.press.pressIn();
    h.press.pressOut();
    h.press.press(false);
    time = 1000;
    h.press.pressIn();
    h.press.pressOut();
    h.press.press(false);
    expect(h.events).toEqual(['toggle', 'toggle']);
  });

  it('starts once on hold and stops once on release, suppressing release clicks', () => {
    const h = harness();
    h.press.pressIn();
    h.press.hold();
    h.press.hold();
    h.press.release();
    h.press.release();
    h.press.press(true);
    expect(h.events).toEqual(['start', 'stop']);
  });

  it('allows the next normal tap after hold even when native suppressed its own release click', () => {
    const h = harness();
    h.press.pressIn();
    h.press.hold();
    h.press.release();
    h.press.pressIn();
    h.press.release();
    h.press.press(true);
    expect(h.events).toEqual(['start', 'stop', 'toggle']);
  });

  it('keeps keyboard and screenreader activation as toggle, including immediately after a hold', () => {
    const h = harness();
    h.press.press(false);
    h.press.pressIn();
    h.press.hold();
    h.press.release();
    h.press.press(false);
    expect(h.events).toEqual(['toggle', 'start', 'stop', 'toggle']);
  });

  it('starts a hold even when native movement cancelled its long-press callback', async () => {
    const h = harness(5);
    h.press.pressIn();
    await Bun.sleep(20);
    expect(h.events).toEqual(['start']);
    h.press.pressOut();
    h.press.release();
    h.press.press(true);
    expect(h.events).toEqual(['start', 'stop']);
  });

  it('treats leaving the button as hold cancellation and never rearms on reentry', () => {
    let time = 0;
    const h = harness(350, () => time);
    h.press.pressIn();
    time = 400;
    h.press.hold();
    h.press.pressOut();
    h.press.pressIn();
    expect(h.events).toEqual(['start', 'stop']);
    h.press.release();
    h.press.pressOut();
    h.press.press(true);
    expect(h.events).toEqual(['start', 'stop']);
    h.press.pressIn();
    h.press.release();
    h.press.press(true);
    expect(h.events).toEqual(['start', 'stop', 'toggle']);
  });

  it('suppresses a held release even when timer execution was delayed', () => {
    let time = 0;
    const h = harness(350, () => time);
    h.press.pressIn();
    time = 400;
    h.press.press(true);
    h.press.release();
    expect(h.events).toEqual([]);
  });

  it('cancels an interrupted touch without a late timer or release toggle', async () => {
    const h = harness(5);
    h.press.pressIn();
    h.press.pressOut();
    await Bun.sleep(20);
    h.press.cancel();
    h.press.press(true);
    expect(h.events).toEqual([]);
  });

  it('does not start a timed hold for keyboard activation', async () => {
    const h = harness(5);
    h.press.pressIn(false);
    await Bun.sleep(20);
    h.press.pressOut();
    h.press.press(false);
    expect(h.events).toEqual(['toggle']);
  });

  it('never starts from a late long-press callback after release or reset', () => {
    const h = harness();
    h.press.pressIn();
    h.press.release();
    h.press.hold();
    h.press.pressIn();
    h.press.reset();
    h.press.hold();
    h.press.release();
    expect(h.events).toEqual([]);
  });
});
