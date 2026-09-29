import { createValueStore } from './persistedStore';
import { readNamespaced } from '../platform/storageNamespace';

const KEY = 'chat.memberList';

function savedOpen(): boolean {
  return typeof localStorage !== 'undefined' && readNamespaced(localStorage, KEY) === '1';
}

const store = createValueStore<boolean>({
  key: KEY,
  default: savedOpen(),
  serialize: (open) => (open ? '1' : '0'),
  deserialize: (raw) => raw === '1',
});

export const useMemberListOpen = (): boolean => store.use();

export function toggleMemberList(): void {
  store.set(!store.get());
}
