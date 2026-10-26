import { describe, expect, test } from 'bun:test';
import { type ProfileProgress, type ProfileSetup, runProfileSetup, type ProfileSetupDeps } from '../src/profile/setup';

const HASH = `0x${'1'.repeat(64)}` as const;
const profile: ProfileSetup = { label: 'synthetic123', displayName: 'Synthetic', image: { uri: 'data:image/png;base64,c3ludGhldGlj', mime: 'image/png' } };

function harness(overrides: Partial<ProfileSetupDeps> = {}) {
  let owned = false;
  let ready = false;
  let progress: ProfileProgress = {};
  const calls: string[] = [];
  const deps: ProfileSetupDeps = {
    assertCurrent: () => undefined,
    upload: () => { calls.push('upload'); return Promise.resolve('ipfs://syntheticavatar'); },
    inspect: () => { calls.push('inspect'); return Promise.resolve({ owned, ready }); },
    claim: () => { calls.push('claim'); owned = true; return Promise.resolve(); },
    send: (_label, records) => { calls.push(`send:${records.avatar ?? 'no-avatar'}`); return Promise.resolve(HASH); },
    confirm: () => { calls.push('confirm'); ready = true; return Promise.resolve(true); },
    ...overrides,
  };
  const save = (next: ProfileProgress): Promise<void> => { progress = structuredClone(next); calls.push('checkpoint'); return Promise.resolve(); };
  return { deps, calls, save, progress: () => progress, setReady: () => { owned = true; ready = true; }, run: () => runProfileSetup(deps, profile, progress, save) };
}

describe('resumable requested profile', () => {
  test('uploads and checkpoints the requested image before claiming or saving a domain', async () => {
    const h = harness();
    await h.run();
    expect(h.calls.indexOf('upload')).toBeLessThan(h.calls.indexOf('claim'));
    expect(h.calls.indexOf('checkpoint')).toBeLessThan(h.calls.indexOf('claim'));
    expect(h.calls).toContain('send:ipfs://syntheticavatar');
    expect(h.calls.at(-1)).toBe('inspect');
  });

  test('a failed upload is a failure, not a profile skip or a partial domain claim', async () => {
    const h = harness({ upload: () => Promise.reject(new Error('upload offline')) });
    await expect(h.run()).rejects.toThrow('upload offline');
    expect(h.calls).toEqual([]);
    expect(h.progress()).toEqual({});
  });

  test('a saved image is not uploaded again after a later claim failure', async () => {
    const h = harness({ claim: () => Promise.reject(new Error('issuer offline')) });
    await expect(h.run()).rejects.toThrow('issuer offline');
    expect(h.progress().avatar).toBe('ipfs://syntheticavatar');
    await expect(h.run()).rejects.toThrow('issuer offline');
    expect(h.calls.filter(value => value === 'upload')).toHaveLength(1);
  });

  test('a previously owned username continues profile setup without claiming it again', async () => {
    let reads = 0;
    const h = harness({ inspect: () => Promise.resolve({ owned: true, ready: ++reads > 1 }) });
    await h.run();
    expect(h.calls).not.toContain('claim');
    expect(h.calls).toContain('send:ipfs://syntheticavatar');
  });

  test('a lost receipt is checked again with the same hash, without a second upload, claim or send', async () => {
    const h = harness({ confirm: () => Promise.reject(new Error('receipt offline')) });
    await expect(h.run()).rejects.toThrow('receipt offline');
    expect(h.progress().transactions).toEqual([HASH]);
    h.deps.confirm = () => { h.setReady(); return Promise.resolve(true); };
    await h.run();
    expect(h.calls.filter(value => value.startsWith('send:'))).toHaveLength(1);
    expect(h.calls.filter(value => value === 'claim')).toHaveLength(1);
    expect(h.calls.filter(value => value === 'upload')).toHaveLength(1);
  });

  test('an unknown submission outcome is read back, never automatically resubmitted', async () => {
    const h = harness({ send: () => { h.calls.push('uncertain-send'); return Promise.reject(new Error('connection lost')); } });
    await expect(h.run()).rejects.toThrow('connection lost');
    await expect(h.run()).rejects.toThrow('No second transaction');
    expect(h.calls.filter(value => value === 'uncertain-send')).toHaveLength(1);
    h.setReady();
    await h.run();
    expect(h.calls.filter(value => value === 'uncertain-send')).toHaveLength(1);
  });

  test('a known revert permits a later explicit retry, not an automatic retry', async () => {
    const h = harness({ confirm: () => Promise.resolve(false) });
    await expect(h.run()).rejects.toThrow('reverted');
    expect(h.progress().submitting).toBe(false);
    expect(h.calls.filter(value => value.startsWith('send:'))).toHaveLength(1);
    h.deps.confirm = () => { h.setReady(); return Promise.resolve(true); };
    await h.run();
    expect(h.calls.filter(value => value.startsWith('send:'))).toHaveLength(2);
  });

  test('confirmed transactions do not finish onboarding until requested records read back correctly', async () => {
    const h = harness({ confirm: () => Promise.resolve(true) });
    await expect(h.run()).rejects.toThrow('records are not confirmed');
    await expect(h.run()).rejects.toThrow('records are not confirmed');
    expect(h.calls.filter(value => value.startsWith('send:'))).toHaveLength(1);
  });

  test('an account switch during upload prevents the claim and transaction', async () => {
    let switched = false;
    const h = harness({
      upload: () => { switched = true; return Promise.resolve('ipfs://syntheticavatar'); },
      assertCurrent: () => { if (switched) throw new Error('account changed'); },
    });
    await expect(h.run()).rejects.toThrow('account changed');
    expect(h.calls).toEqual([]);
    expect(h.progress()).toEqual({});
  });

  test('failed authoritative reads cannot become permission to claim or send', async () => {
    const h = harness({ inspect: () => Promise.reject(new Error('RPC unavailable')) });
    await expect(h.run()).rejects.toThrow('RPC unavailable');
    expect(h.calls).not.toContain('claim');
    expect(h.calls.some(value => value.startsWith('send:'))).toBe(false);
  });
});
