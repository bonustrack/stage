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

export interface SelectionScope {
  accountId: string | null;
  current: () => boolean;
  assertCurrent: (message?: string) => void;
}

export interface AccountScope extends SelectionScope {
  epoch: number;
}

function scopeOf(current: () => boolean): Pick<SelectionScope, 'current' | 'assertCurrent'> {
  return {
    current,
    assertCurrent: (message) => {
      if (!current()) throw new AccountChangedError(message);
    },
  };
}

export function selectionScope(): SelectionScope {
  const selection = getAccountSelection();
  return { accountId: activeId.get(), ...scopeOf(() => selection === getAccountSelection()) };
}

export function accountScope(): AccountScope {
  const epoch = getAccountEpoch();
  const selection = getAccountSelection();
  return { accountId: activeId.get(), epoch, ...scopeOf(() => epoch === getAccountEpoch() && selection === getAccountSelection()) };
}
