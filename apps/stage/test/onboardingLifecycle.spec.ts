import { describe, expect, test } from 'bun:test';
import type { PendingSetup, ProfileSetup } from '@stage-labs/client/profile/setup';
import { AccountSetupError, makeOnboarding, type OnboardingDeps } from '../lib/onboarding.core';

const record: NonNullable<PendingSetup['account']> = {
  id: '0x00000000000000000000000000000000000000a1',
  address: '0x00000000000000000000000000000000000000a1',
  type: 'smart',
  dbDir: 'xmtp-0x00000000000000000000000000000000000000a1',
  registered: false,
  createdAt: 1,
  hdIndex: 0,
  phraseId: 'synthetic-phrase-reference',
  ownerAddress: '0x00000000000000000000000000000000000000a2',
};
const profile: ProfileSetup = {
  label: 'synthetic123',
  image: { uri: 'data:image/png;base64,c3ludGhldGlj', mime: 'image/png' },
  displayName: 'Synthetic',
};

function harness(overrides: Partial<OnboardingDeps> = {}) {
  let pending: PendingSetup | null = null;
  const log: string[] = [];
  const deps: OnboardingDeps = {
    read: () => Promise.resolve(pending),
    write: (value) => {
      pending = structuredClone(value);
      log.push(`save:${value.stage}:${value.account?.id ?? 'none'}`);
      return Promise.resolve(undefined);
    },
    clear: () => {
      pending = null;
      log.push('finish');
      return Promise.resolve(undefined);
    },
    preserveImage: (value) => Promise.resolve(value),
    create: async (prepared) => {
      log.push('prepare');
      await prepared(record);
      log.push('persist-wallet');
      return record;
    },
    resume: (value) => {
      log.push(`resume:${value.id}`);
      return Promise.resolve(value);
    },
    messaging: (id) => {
      log.push(`messaging:${id}`);
      return Promise.resolve(undefined);
    },
    profile: (_account, value) => {
      log.push(`profile:${value.label}:${value.image?.uri ?? 'none'}`);
      return Promise.resolve(undefined);
    },
    ...overrides,
  };
  return { deps, setup: makeOnboarding(deps), log, pending: () => pending };
}

describe('durable account onboarding', () => {
  test('checkpoints the exact public account before its first persistence', async () => {
    const h = harness();
    await h.setup.run(profile);
    expect(h.log.indexOf(`save:wallet:${record.id}`)).toBeLessThan(h.log.indexOf('persist-wallet'));
    expect(h.log.at(-1)).toBe('finish');
    expect(h.pending()).toBeNull();
  });

  for (const boundary of ['messaging', 'profile'] as const) {
    test(`a failed ${boundary} retains the requested profile and resumes the same wallet after reload`, async () => {
      const failure = new Error(`${boundary} offline`);
      const h = harness({ [boundary]: () => Promise.reject(failure) });
      await expect(h.setup.run(profile)).rejects.toBeInstanceOf(AccountSetupError);
      expect(h.pending()?.account?.id).toBe(record.id);
      expect(h.pending()?.profile).toEqual(profile);
      expect(h.log).not.toContain('finish');
      h.deps[boundary] =
        boundary === 'messaging'
          ? () => Promise.resolve()
          : (_account, value) => {
              h.log.push(`profile:${value.label}:${value.image?.uri ?? 'none'}`);
              return Promise.resolve(undefined);
            };
      await makeOnboarding(h.deps).resume();
      expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
      expect(h.log).toContain(`resume:${record.id}`);
      expect(h.log).toContain(`profile:${profile.label}:${profile.image?.uri ?? 'none'}`);
      expect(h.log.at(-1)).toBe('finish');
    });
  }

  test('late account-list or selection persistence failure resumes the prepared wallet without deriving another', async () => {
    const h = harness({
      create: async (prepared) => {
        await prepared(record);
        throw new Error('active selection unavailable');
      },
    });
    await expect(h.setup.run(profile)).rejects.toThrow('active selection unavailable');
    expect(h.pending()?.account?.id).toBe(record.id);
    await makeOnboarding(h.deps).resume();
    expect(h.log).toContain(`resume:${record.id}`);
    expect(h.log.at(-1)).toBe('finish');
  });

  test('a failed checkpoint prevents account persistence and downstream work', async () => {
    const h = harness({ write: () => Promise.reject(new Error('storage full')) });
    await expect(h.setup.run(profile)).rejects.toThrow('storage full');
    expect(h.log).toEqual([]);
  });

  for (const committed of [false, true]) {
    test(`a one-shot prepared checkpoint failure retries the same account when committed is ${String(committed)}`, async () => {
      const h = harness();
      const write = h.deps.write;
      let writes = 0;
      h.deps.write = async (value) => {
        if (++writes === 2) {
          if (committed) await write(value);
          throw new Error('prepared checkpoint unavailable');
        }
        await write(value);
      };
      await expect(h.setup.run(profile)).rejects.toThrow('prepared checkpoint unavailable');
      await h.setup.resume();
      expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
      expect(h.log).toContain(`resume:${record.id}`);
      expect(h.log.at(-1)).toBe('finish');
    });
  }

  test('a failed progress write retains its known transaction rather than reverting to the predecessor', async () => {
    const hash = `0x${'1'.repeat(64)}` as const;
    const h = harness({
      profile: async (_account, _profile, _progress, checkpoint) => {
        await checkpoint({ submitting: true, transactions: [hash] });
      },
    });
    const write = h.deps.write;
    let fail = true;
    h.deps.write = async (value) => {
      if (fail && value.progress?.transactions?.length) {
        fail = false;
        throw new Error('hash checkpoint unavailable');
      }
      await write(value);
    };
    await expect(h.setup.run(profile)).rejects.toThrow('hash checkpoint unavailable');
    h.deps.profile = async (_account, _profile, progress) => {
      expect(progress.transactions).toEqual([hash]);
    };
    await h.setup.resume();
    expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
  });

  test('a different durable setup cannot replace an unconfirmed prepared account', async () => {
    const h = harness();
    const write = h.deps.write;
    h.deps.write = (value) => (value.account === undefined ? write(value) : Promise.reject(new Error('prepared checkpoint unavailable')));
    await expect(h.setup.run(profile)).rejects.toThrow('prepared checkpoint unavailable');
    await write({ version: 1, stage: 'wallet', profile: { label: 'different123' } });
    h.deps.write = write;
    await expect(h.setup.resume()).rejects.toThrow('saved setup changed');
    expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
    expect(h.log).not.toContain(`resume:${record.id}`);
  });

  test('an unreadable checkpoint never becomes an empty setup or a fresh wallet', async () => {
    const h = harness({ read: () => Promise.reject(new Error('storage unavailable')) });
    await expect(h.setup.run(profile)).rejects.toThrow('storage unavailable');
    expect(h.log).toEqual([]);
  });

  test('retry before the first checkpoint retains the requested image and label in memory', async () => {
    let attempts = 0;
    const h = harness({
      preserveImage: (value) => (++attempts === 1 ? Promise.reject(new Error('image unavailable')) : Promise.resolve(value)),
    });
    await expect(h.setup.run(profile)).rejects.toThrow('image unavailable');
    expect(h.log).toEqual([]);
    await h.setup.resume();
    expect(h.log).toContain(`profile:${profile.label}:${profile.image?.uri ?? 'none'}`);
  });

  test('an intentional profile skip stays a skip', async () => {
    const h = harness();
    await h.setup.run();
    expect(h.log.some((value) => value.startsWith('profile:'))).toBe(false);
    expect(h.log.at(-1)).toBe('finish');
  });

  test('a repeated click joins the same setup rather than creating a second account', async () => {
    const gate = Promise.withResolvers<undefined>();
    const h = harness({ messaging: () => gate.promise });
    const first = h.setup.run(profile);
    const second = h.setup.run(profile);
    expect(first).toBe(second);
    gate.resolve(undefined);
    await Promise.all([first, second]);
    expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
  });

  test('a post-delete checkpoint failure resumes the same prepared identity in memory', async () => {
    const h = harness();
    const clear = h.deps.clear;
    h.deps.clear = async () => {
      await clear();
      throw new Error('late delete error');
    };
    await expect(h.setup.run(profile)).rejects.toThrow('late delete error');
    expect(h.pending()).toBeNull();
    h.deps.clear = clear;
    await h.setup.resume();
    expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
    expect(h.log).toContain(`resume:${record.id}`);
  });

  test('editing a failed profile keeps the prepared account and can replace an unclaimed label', async () => {
    const h = harness({ profile: () => Promise.reject(new Error('taken')) });
    await expect(h.setup.run(profile)).rejects.toThrow('taken');
    const reloaded = makeOnboarding(h.deps);
    expect((await reloaded.editableProfile()).labelLocked).toBe(false);
    await reloaded.editProfile({ ...profile, label: 'synthetic456' });
    expect(h.pending()?.account?.id).toBe(record.id);
    expect(h.pending()?.profile?.label).toBe('synthetic456');
    h.deps.profile = () => Promise.resolve(undefined);
    await reloaded.resume();
    expect(h.log.filter((value) => value === 'prepare')).toHaveLength(1);
  });

  test('a claimed name stays locked and an uncertain profile transaction cannot be edited', async () => {
    const h = harness({
      profile: async (_account, _profile, _progress, checkpoint) => {
        await checkpoint({ claimed: true });
        throw new Error('offline');
      },
    });
    await expect(h.setup.run(profile)).rejects.toThrow('offline');
    expect((await h.setup.editableProfile()).labelLocked).toBe(true);
    await expect(h.setup.editProfile({ ...profile, label: 'different123' })).rejects.toThrow('already being registered');
    await h.deps.write({ ...h.pending(), version: 1, stage: 'profile', account: record, profile, progress: { submitting: true } });
    await expect(h.setup.editableProfile()).rejects.toThrow('pending profile save');
    await expect(h.setup.editProfile(profile)).rejects.toThrow('pending profile save');
  });

  test('resume without a saved or in-memory attempt never creates an account', async () => {
    const h = harness();
    await expect(h.setup.resume()).rejects.toThrow('No saved setup');
    expect(h.log).toEqual([]);
  });
});
