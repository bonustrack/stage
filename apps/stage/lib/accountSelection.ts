import { makeValue } from './storeCore';
import { getAccountEpoch } from './accountEpoch';

export class NoAccountError extends Error {
  constructor() {
    super('No account: onboarding not completed yet.');
    this.name = 'NoAccountError';
  }
}

export class AccountChangedError extends Error {
  constructor(message = 'Messaging account changed') {
    super(message);
    this.name = 'AccountChangedError';
  }
}

const version = makeValue(0);

export function accountSelectionChanged(): void {
  version.set(version.get() + 1);
}

export const getAccountSelection = version.get;

export const subscribeAccountSelection = version.subscribe;

export const useAccountSelection = version.use;

const activeId = makeValue<string | null>(null);

export function rememberActiveAccountId(id: string | null): void {
  if (id !== activeId.get()) activeId.set(id);
}

export const knownActiveAccountId = activeId.get;

export const subscribeActiveAccountId = activeId.subscribe;

let readActive = (): Promise<string | null> => Promise.resolve(activeId.get());

export function provideActiveAccountReader(read: () => Promise<string | null>): void {
  readActive = read;
}

export function readActiveAccountId(): Promise<string | null> {
  return readActive();
}

export interface AccountScope {
  accountId: string | null;
  epoch: number;
  current: () => boolean;
  assertCurrent: () => void;
}

export function accountScope(): AccountScope {
  const epoch = getAccountEpoch();
  const selection = getAccountSelection();
  const current = (): boolean => epoch === getAccountEpoch() && selection === getAccountSelection();
  return {
    accountId: activeId.get(),
    epoch,
    current,
    assertCurrent: () => {
      if (!current()) throw new AccountChangedError();
    },
  };
}
