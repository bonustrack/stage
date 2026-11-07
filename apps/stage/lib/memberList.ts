import { createValueStore, flagCodec } from './persistedStore';
import { makeValue } from './storeCore';

const store = createValueStore<boolean>({ key: 'chat.memberList', default: false, readNow: true, ...flagCodec(false) });

export const useMemberListOpen = (): boolean => store.use();

export function toggleMemberList(): void {
  store.set(!store.get());
}

const addMembersConv = makeValue<string | null>(null);

export function openAddMembers(convId: string): void {
  addMembersConv.set(convId);
}

export function closeAddMembers(): void {
  addMembersConv.set(null);
}

export const useAddMembersConv = addMembersConv.use;
