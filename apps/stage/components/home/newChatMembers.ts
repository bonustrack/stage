import { reported } from '../../lib/errorPolicy';
import { createValueStore } from '../../lib/persistedStore';
import { NO_MEMBER_HISTORY, parseMemberHistory, startedChatWith, type MemberHistory } from './newChat.model';

const memberHistory = createValueStore<MemberHistory>({
  key: 'new-chat.members.', default: NO_MEMBER_HISTORY, deserialize: parseMemberHistory, serialize: JSON.stringify, perAccount: true,
});

export const useNewChatMembers = memberHistory.use;

export function rememberStartedChat(members: readonly string[]): void {
  void memberHistory.update(current => startedChatWith(current, members, Date.now())).catch(reported('newChatMembers.save'));
}
