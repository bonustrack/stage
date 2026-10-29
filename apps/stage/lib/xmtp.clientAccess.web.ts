import type { Client } from '@xmtp/browser-sdk';

type ClientReads = Pick<Client<unknown>, 'canMessage' | 'fetchInboxIdByIdentifier' | 'fetchKeyPackageStatuses'>;
type ClientSigning = Pick<Client<unknown>, 'signWithInstallationKey' | 'verifySignedWithInstallationKey'>;
type PreferenceReads = Pick<
  Client<unknown>['preferences'],
  'sync' | 'inboxState' | 'fetchInboxState' | 'getInboxStates' | 'fetchInboxStates' | 'setConsentStates' | 'getConsentState'
>;
type ConversationReads = Pick<Client<unknown>['conversations'], 'fetchDmByIdentifier'>;
type AccessClient = ClientReads & ClientSigning & { preferences: PreferenceReads; conversations: ConversationReads };

type Access = <T>(run: () => Promise<T>) => Promise<T>;
const guarded = new WeakSet<object>();

function makeAccess(): { read: Access; write: Access } {
  let writer: Promise<unknown> = Promise.resolve();
  const readers = new Set<Promise<unknown>>();
  const read: Access = (run) => {
    const pending = writer.then(run);
    readers.add(pending);
    const release = (): void => {
      readers.delete(pending);
    };
    void pending.then(release, release);
    return pending;
  };
  const write: Access = (run) => {
    const pending = Promise.allSettled([writer, ...readers]).then(run);
    writer = Promise.allSettled([pending]);
    return pending;
  };
  return { read, write };
}

function wrap<A extends unknown[], R>(owner: object, method: (...args: A) => Promise<R>, access: Access): (...args: A) => Promise<R> {
  return (...args) => access(() => method.apply(owner, args));
}

export function guardClientAccess<C extends AccessClient>(client: C): C {
  if (guarded.has(client)) return client;
  const { read, write } = makeAccess();
  Object.assign(client, {
    canMessage: wrap(client, client.canMessage, read),
    fetchInboxIdByIdentifier: wrap(client, client.fetchInboxIdByIdentifier, read),
    fetchKeyPackageStatuses: wrap(client, client.fetchKeyPackageStatuses, read),
    signWithInstallationKey: wrap(client, client.signWithInstallationKey, write),
    verifySignedWithInstallationKey: wrap(client, client.verifySignedWithInstallationKey, write),
  } satisfies ClientReads & ClientSigning);
  const conversations = client.conversations;
  Object.assign(conversations, {
    fetchDmByIdentifier: wrap(conversations, conversations.fetchDmByIdentifier, read),
  } satisfies ConversationReads);
  const preferences = client.preferences;
  Object.assign(preferences, {
    sync: wrap(preferences, preferences.sync, read),
    inboxState: wrap(preferences, preferences.inboxState, read),
    fetchInboxState: wrap(preferences, preferences.fetchInboxState, read),
    getInboxStates: wrap(preferences, preferences.getInboxStates, read),
    fetchInboxStates: wrap(preferences, preferences.fetchInboxStates, read),
    setConsentStates: wrap(preferences, preferences.setConsentStates, read),
    getConsentState: wrap(preferences, preferences.getConsentState, read),
  } satisfies PreferenceReads);
  guarded.add(client);
  return client;
}
