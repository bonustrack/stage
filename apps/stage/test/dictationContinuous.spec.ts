import { describe, expect, it } from 'bun:test';
import { makeDictationPress } from '../components/composer/dictation.press';
import { makeDictationHarness, tick } from './dictationFixture';

const harness = makeDictationHarness();

describe('continuous dictation', () => {
  it('commits each utterance once, replaces partials and preserves the surrounding draft', async () => {
    const h = harness();
    await h.control.toggle();
    const first = h.starts[0];
    h.event({ text: 'a' });
    h.event({ text: 'Alice.', state: 'ended', reason: 'segment' });
    expect(h.phases.at(-1)).toBe('restarting');
    await tick();
    expect(h.starts).toHaveLength(2);
    expect(h.starts[1]).not.toBe(first);
    h.event({ text: 'Wrong stale final', state: 'ended', reason: 'segment' }, first);
    h.event({ text: 'And B' });
    h.event({ text: 'And Bob.' });
    await h.control.toggle();
    h.event({ text: 'And Bob!', state: 'ended', reason: 'segment' });
    await tick();
    expect(h.draft().text).toBe('Hello Alice. And Bob! tomorrow');
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.starts).toHaveLength(2);
    expect(h.permissions()).toBe(1);
    expect(h.stops).toHaveLength(1);
  });

  it('remains armed through silence and empty final results without dropping partial text', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'Alice' });
    h.event({ text: '', state: 'ended', reason: 'silence' });
    await tick();
    expect(h.draft().text).toBe('Hello Alice tomorrow');
    expect(h.starts).toHaveLength(2);
    h.event({ state: 'ended', reason: 'silence' });
    await tick();
    expect(h.starts).toHaveLength(3);
    expect(h.errors).toEqual([null]);
  });

  it('cancels a scheduled restart when the mic is tapped again', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'Alice', state: 'ended', reason: 'segment' });
    await h.control.toggle();
    await tick();
    expect(h.starts).toHaveLength(1);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.draft().text).toBe('Hello Alice tomorrow');
  });

  it('does not revive on native cancellation, interruption or an untyped old-binary terminal event', async () => {
    for (const reason of ['cancelled', undefined] as const) {
      const h = harness();
      await h.control.start();
      h.event({ state: 'ended', reason });
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.phases.at(-1)).toBe('idle');
    }
  });

  it('cancels an interruption received in the gap after a completed utterance', async () => {
    const h = harness();
    await h.control.start();
    const id = h.starts[0];
    h.event({ text: 'Alice', state: 'ended', reason: 'segment' });
    h.event({ state: 'ended', reason: 'cancelled' }, id);
    await tick();
    expect(h.starts).toHaveLength(1);
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('preserves a native startup error attached to cancellation', async () => {
    const h = harness();
    await h.control.start();
    h.event({ state: 'ended', reason: 'cancelled', error: 'Could not start microphone' });
    expect(h.errors.at(-1)).toBe('Could not start microphone');
  });

  it('never retries busy, microphone, language or cleanup errors', async () => {
    for (const error of ['Recognizer busy', 'Microphone unavailable', 'Language unavailable', 'Audio restoration failed']) {
      const h = harness();
      await h.control.start();
      h.event({ text: 'Alice', state: 'ended', reason: 'segment', error });
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.errors.at(-1)).toBe(error);
      expect(h.draft().text).toBe('Hello Alice tomorrow');
    }
  });

  it('never rotates a native finalization watchdog failure', async () => {
    for (const reason of ['cancelled', 'segment'] as const) {
      const h = harness();
      await h.control.start();
      h.event({ text: 'Alice', state: 'finishing' });
      h.event({ state: 'ended', reason, error: 'Dictation could not finish. Check your draft and tap the mic to try again.' });
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.phases.at(-1)).toBe('idle');
      expect(h.errors.at(-1)).toContain('could not finish');
      expect(h.draft().text).toBe('Hello Alice tomorrow');
    }
  });

  it('bounds empty immediate terminations instead of creating a retry loop', async () => {
    const h = harness();
    await h.control.start();
    for (let i = 0; i < 3; i += 1) {
      h.event({ state: 'ended', reason: 'silence' });
      await tick();
    }
    expect(h.starts).toHaveLength(3);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.errors.at(-1)).toContain('ending too quickly');
  });

  it('rotates the bounded native segment without treating its limit as an explicit user stop', async () => {
    const h = harness({}, {}, 5);
    await h.control.start();
    h.event({ text: 'Alice' });
    await tick();
    expect(h.stops).toHaveLength(1);
    expect(h.phases.at(-1)).toBe('restarting');
    h.event({ state: 'ended', reason: 'segment' });
    await tick();
    expect(h.starts).toHaveLength(2);
    expect(h.phases).not.toContain('idle');
  });

  it('preserves endpoint finals when the user stops during finalization', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'Ali', state: 'finishing' });
    await h.control.stop();
    h.event({ text: 'Alice', state: 'ended', reason: 'segment' });
    await tick();
    expect(h.starts).toHaveLength(1);
    expect(h.stops).toHaveLength(0);
    expect(h.draft().text).toBe('Hello Alice tomorrow');
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('cancels a restart on editing, backgrounding, navigation, disposal and audio takeover', async () => {
    for (const action of ['edit', 'background', 'inactive', 'cancel', 'dispose', 'block'] as const) {
      const h = harness();
      await h.control.start();
      h.event({ text: 'Alice', state: 'ended', reason: 'segment' });
      if (action === 'edit') h.edit();
      else if (action === 'block') h.block();
      else await h.control[action]();
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.draft().text).toBe(action === 'edit' ? 'My edit' : 'Hello Alice tomorrow');
    }
  });

  it('waits for old startup and cleanup before a new capture and ignores duplicated terminal events', async () => {
    const started = Promise.withResolvers<undefined>();
    const entered = Promise.withResolvers<string>();
    let calls = 0;
    const h = harness({ start: async id => { calls += 1; entered.resolve(id); if (calls === 1) await started.promise; } });
    const start = h.control.start();
    const id = await entered.promise;
    h.event({ text: 'Alice', state: 'ended', reason: 'segment' }, id);
    h.event({ text: 'Duplicate', state: 'ended', reason: 'segment' }, id);
    await tick();
    expect(calls).toBe(1);
    started.resolve(undefined);
    await start;
    await tick();
    expect(calls).toBe(2);
    expect(h.cancels.filter(value => value === id)).toHaveLength(2);
    expect(h.draft().text).toBe('Hello Alice tomorrow');
  });

  it('blocks automatic restart after failed cleanup until an explicit successful retry', async () => {
    let fail = true;
    const h = harness({ cancel: async () => { if (fail) throw new Error('release failed'); } });
    await h.control.start();
    h.event({ text: 'Alice', state: 'ended', reason: 'segment' });
    await tick();
    expect(h.starts).toHaveLength(1);
    expect(h.errors).toContain('release failed');
    fail = false;
    await h.control.start();
    expect(h.starts).toHaveLength(2);
  });

  it('release before permission completes cannot start the microphone later', async () => {
    const permitted = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    const h = harness({}, { microphoneGranted: async () => false, permission: () => { entered.resolve(undefined); return permitted.promise; } });
    const press = makeDictationPress({ start: () => { void h.control.start(); }, stop: () => { void h.control.stop(); }, toggle: () => { void h.control.toggle(); } });
    press.pressIn();
    press.hold();
    await entered.promise;
    press.release();
    press.press(true);
    permitted.resolve(true);
    await tick();
    expect(h.starts).toHaveLength(0);
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('release during native startup drains and cancels the late start without revival', async () => {
    const started = Promise.withResolvers<undefined>();
    const entered = Promise.withResolvers<string>();
    const h = harness({ start: id => { entered.resolve(id); return started.promise; } });
    const starting = h.control.start();
    const id = await entered.promise;
    const stopped = h.control.stop();
    h.event({ state: 'listening' }, id);
    started.resolve(undefined);
    await Promise.all([starting, stopped]);
    expect(h.cancels).toEqual([id, id]);
    expect(h.phases.at(-1)).toBe('idle');
  });
});
