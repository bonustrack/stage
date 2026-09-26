import { makeListeners, useStoreValue } from './storeCore';

let current: string | null = null;
const { notify, subscribe } = makeListeners();

function get(): string | null { return current; }

export function openAddMembers(convId: string): void {
  current = convId;
  notify();
}

export function closeAddMembers(): void {
  current = null;
  notify();
}

export function useAddMembersConv(): string | null {
  return useStoreValue(subscribe, get);
}
