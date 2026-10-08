import { describe, expect, it } from 'bun:test';
import { makeDictationHarness, tick } from './dictationFixture';

const harness = makeDictationHarness();
const fallback = { state: 'ended', reason: 'fallback', notice: 'Continuing in en-US. Check your draft.' } as const;

describe('dictation language fallback', () => {
  it('reports unsupported automatic switching without blocking default-language dictation', async () => {
    const notice = 'Dictation uses en-US. Automatic language switching needs Android 14 or later.';
    const h = harness({ availability: async () => ({ available: true, download: false, locale: 'en-US', notice }) });
    await h.control.start();
    expect(h.phases.at(-1)).toBe('listening');
    expect(h.errors).toEqual([null, notice]);
    expect(h.downloads()).toBe(0);
  });

  it('keeps engine-dependent switching provisional without blocking on-device capture', async () => {
    const notice = 'Automatic language switching depends on the device speech engine.';
    const h = harness({ availability: async () => ({ available: true, download: false, locale: 'en-US', notice }) });
    await h.control.start();
    expect(h.errors).toEqual([null, notice]);
    expect(h.phases.at(-1)).toBe('listening');
    expect(h.downloads()).toBe(0);
  });

  it('never downloads a speech model without explicit consent', async () => {
    const h = harness({ availability: async () => ({ available: false, download: true, locale: 'en-US' }) });
    await h.control.start();
    expect(h.downloads()).toBe(0);
    expect(h.starts).toHaveLength(0);
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('retains the existing single-model consent flow instead of starting or downloading in a loop', async () => {
    const h = harness({ availability: async () => ({ available: false, download: true, locale: 'en-US' }) }, { confirmDownload: async () => true });
    await h.control.start();
    expect(h.downloads()).toBe(1);
    expect(h.starts).toHaveLength(0);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.errors.at(-1)).toContain('Speech model requested');
  });

  it('does not insert language metadata into a draft or restart a listening capture', async () => {
    const h = harness();
    await h.control.start();
    h.event({ locale: 'fr-FR' });
    expect(h.draft().text).toBe('Hello there tomorrow');
    h.event({ text: 'Bonjour' });
    h.event({ locale: 'de-DE' });
    expect(h.draft().text).toBe('Hello Bonjour tomorrow');
    expect(h.phases.at(-1)).toBe('listening');
    expect(h.starts).toHaveLength(1);
  });

  it('preserves partials, drains cleanup and continues once after native fallback', async () => {
    const h = harness();
    await h.control.start();
    const old = h.starts[0];
    h.event({ text: 'Bonjour' });
    h.event(fallback);
    await tick();
    expect(h.starts).toHaveLength(2);
    expect(h.cancels).toContain(old);
    expect(h.errors.at(-1)).toBe(fallback.notice);
    h.event({ text: 'Corrupt stale final', ...fallback, locale: 'de-DE' }, old);
    h.event({ text: 'Hello' });
    expect(h.draft().text).toBe('Hello Bonjour Hello tomorrow');
    expect(h.downloads()).toBe(0);
    expect(h.phases.at(-1)).toBe('listening');
  });

  it('resets the rapid-empty budget for the first fallback and still bounds default-language retries', async () => {
    const h = harness();
    await h.control.start();
    for (let i = 0; i < 2; i += 1) {
      h.event({ state: 'ended', reason: 'silence' });
      await tick();
    }
    h.event(fallback);
    await tick();
    expect(h.starts).toHaveLength(4);
    expect(h.phases.at(-1)).toBe('listening');
    expect(h.errors.at(-1)).toBe(fallback.notice);
    for (let i = 0; i < 3; i += 1) {
      h.event({ state: 'ended', reason: 'silence' });
      await tick();
    }
    expect(h.starts).toHaveLength(6);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.errors.at(-1)).toContain('ending too quickly');
    expect(h.draft().text).toBe('Hello there tomorrow');
  });

  it('bounds fallback over the whole session even when productive captures intervene', async () => {
    const h = harness();
    await h.control.start();
    h.event(fallback);
    await tick();
    h.event({ text: 'Hello', state: 'ended', reason: 'segment' });
    await tick();
    h.event(fallback);
    await tick();
    expect(h.starts).toHaveLength(3);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.errors.at(-1)).toContain('could not return');
    expect(h.draft().text).toBe('Hello Hello tomorrow');
  });

  it('never restarts fallback after explicit stop or during the restart gap', async () => {
    for (const stopFirst of [true, false]) {
      const h = harness();
      await h.control.start();
      h.event({ text: 'Bonjour' });
      if (stopFirst) await h.control.stop();
      h.event(fallback);
      if (!stopFirst) await h.control.stop();
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.phases.at(-1)).toBe('idle');
      expect(h.draft().text).toBe('Hello Bonjour tomorrow');
    }
  });

  it('never revives an edited, backgrounded or cancelled session from late language events', async () => {
    for (const action of ['edit', 'background', 'cancel'] as const) {
      const h = harness();
      await h.control.start();
      h.event({ text: 'Bonjour' });
      if (action === 'edit') h.edit();
      else await h.control[action]();
      h.event({ ...fallback, text: 'Stale', locale: 'de-DE' });
      await tick();
      expect(h.starts).toHaveLength(1);
      expect(h.errors).toEqual([null]);
      expect(h.draft().text).toBe(action === 'edit' ? 'My edit' : 'Hello Bonjour tomorrow');
    }
  });

  it('treats a fallback event carrying an error as terminal', async () => {
    const h = harness();
    await h.control.start();
    h.event({ ...fallback, error: 'Microphone could not be released' });
    await tick();
    expect(h.starts).toHaveLength(1);
    expect(h.errors.at(-1)).toBe('Microphone could not be released');
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('allows a fresh explicit session to attempt one new fallback', async () => {
    const h = harness();
    for (let i = 0; i < 2; i += 1) {
      await h.control.start();
      h.event(fallback);
      await tick();
      expect(h.phases.at(-1)).toBe('listening');
      await h.control.cancel();
    }
    expect(h.starts).toHaveLength(4);
  });
});
