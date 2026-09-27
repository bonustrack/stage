import { createValueStore } from './persistedStore';

const store = createValueStore<boolean>({
  key: 'chat.memberList',
  default: false,
  serialize: (open) => (open ? '1' : '0'),
  deserialize: (raw) => raw === '1',
});

export const useMemberListOpen = (): boolean => store.use();

export function toggleMemberList(): void {
  store.set(!store.get());
}
