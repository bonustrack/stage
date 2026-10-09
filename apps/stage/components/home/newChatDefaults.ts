import { reported } from '../../lib/errorPolicy';
import { createValueStore } from '../../lib/persistedStore';
import { NO_NEW_CHAT_FIELDS, parseNewChatFields, renamedNewChatFields, type NewChatFields } from './newChatMetadata.model';

const defaults = createValueStore<NewChatFields>({
  key: 'new-chat.fields.', default: NO_NEW_CHAT_FIELDS, deserialize: parseNewChatFields, serialize: JSON.stringify, perAccount: true,
});

function save(next: (current: NewChatFields) => NewChatFields): void {
  void defaults.update(next).catch(reported('newChatDefaults.save'));
}

export const useNewChatDefaults = (): NewChatFields => defaults.use();

export function setNewChatProject(category: string | null): void {
  save(() => ({ category }));
}

export function renameNewChatProject(from: string, to: string | null): void {
  save(current => renamedNewChatFields(current, from, to));
}
