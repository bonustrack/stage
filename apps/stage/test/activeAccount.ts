import { knownActiveAccountId, rememberActiveAccountId } from '../lib/accountSelection';

export function selectAccount(id: string | null): void {
  rememberActiveAccountId(id);
}

export function selectedAccount(): string {
  const id = knownActiveAccountId();
  if (id === null) throw new Error('No test account is selected');
  return id;
}
