import { describe, expect, test } from 'bun:test';
import { XmtpInstallationLimitError, openWithRecovery, withStoreRecovery } from '../lib/xmtp.recover.core';

const CORRUPT = 'store corrupt';
const LIMIT = 'Cannot register a new installation: 10/10';

function recovery(freeSlots: boolean[] | null) {
  const log: string[] = [];
  const slots = freeSlots === null ? null : [...freeSlots];
  return {
    log,
    recovery: {
      isCorrupt: (e: unknown) => e instanceof Error && e.message === CORRUPT,
      wipe: () => {
        log.push('wipe');
        return Promise.resolve();
      },
      freeInstallationSlot:
        slots === null
          ? null
          : () => {
              log.push('free');
              return Promise.resolve(slots.shift() ?? false);
            },
    },
  };
}

function opener(failures: string[], log: string[]): (wiped: boolean) => Promise<string> {
  const queue = [...failures];
  return (wiped) => {
    log.push(wiped ? 'open:wiped' : 'open');
    const failure = queue.shift();
    return failure === undefined ? Promise.resolve('client') : Promise.reject(new Error(failure));
  };
}

describe('withStoreRecovery', () => {
  test('a corrupt store is wiped once before the reopen, other errors pass through', async () => {
    const { log, recovery: store } = recovery(null);
    const reopen = (): Promise<string> => {
      log.push('reopen');
      return Promise.resolve('fresh');
    };
    expect(await withStoreRecovery(store, () => Promise.reject(new Error(CORRUPT)), reopen)).toBe('fresh');
    expect(log).toEqual(['wipe', 'reopen']);
    await expect(withStoreRecovery(store, () => Promise.reject(new Error('offline')), reopen)).rejects.toThrow('offline');
    expect(log).toEqual(['wipe', 'reopen']);
  });
});

describe('openWithRecovery', () => {
  test('retries a corrupt store once with a wiped store and gives up on a second corruption', async () => {
    const { log, recovery: store } = recovery(null);
    expect(await openWithRecovery(store, opener([CORRUPT], log))).toBe('client');
    expect(log).toEqual(['open', 'wipe', 'open:wiped']);
    log.length = 0;
    await expect(openWithRecovery(store, opener([CORRUPT, CORRUPT], log))).rejects.toThrow(CORRUPT);
    expect(log).toEqual(['open', 'wipe', 'open:wiped']);
  });

  test('without a way to free an installation the limit is reported at once', async () => {
    const { log, recovery: store } = recovery(null);
    const failure = await openWithRecovery(store, opener([LIMIT], log)).catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(XmtpInstallationLimitError);
    expect(failure instanceof Error ? failure.cause : null).toEqual(new Error(LIMIT));
    expect(log).toEqual(['open']);
  });

  test('frees at most one installation, even across a store wipe', async () => {
    const freed = recovery([true, true]);
    expect(await openWithRecovery(freed.recovery, opener([LIMIT], freed.log))).toBe('client');
    expect(freed.log).toEqual(['open', 'free', 'open']);
    const again = recovery([true, true]);
    await expect(openWithRecovery(again.recovery, opener([LIMIT, CORRUPT, LIMIT], again.log))).rejects.toBeInstanceOf(
      XmtpInstallationLimitError,
    );
    expect(again.log).toEqual(['open', 'free', 'open', 'wipe', 'open:wiped']);
    const refused = recovery([false]);
    await expect(openWithRecovery(refused.recovery, opener([LIMIT], refused.log))).rejects.toBeInstanceOf(XmtpInstallationLimitError);
    expect(refused.log).toEqual(['open', 'free']);
  });
});
