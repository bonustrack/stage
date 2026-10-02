import { makeAccountValue } from '../../lib/accountValue';
import { reported } from '../../lib/errorPolicy';
import { useStoreValue } from '../../lib/storeCore';
import { NO_MEMBER_HISTORY, parseMemberHistory, startedChatWith, type MemberHistory } from './newChat.model';

const memberHistory = makeAccountValue<MemberHistory>('new-chat.members.', NO_MEMBER_HISTORY, parseMemberHistory, JSON.stringify);

function primeMembers(): void { void memberHistory.ready().catch(reported('newChatMembers.load')); }

export const useNewChatMembers = (): MemberHistory => useStoreValue(memberHistory.subscribe, memberHistory.get, primeMembers);

export function rememberStartedChat(members: readonly string[]): void {
  void memberHistory.update(current => startedChatWith(current, members, Date.now())).catch(reported('newChatMembers.save'));
}
